import { isRedditConfigured, redditUserAgent } from "@/lib/config";
import { normalizeSubredditName } from "@/lib/subreddits";
import { rerankOpportunityMatches } from "@/lib/ai";
import type {
  ActionCard,
  OpportunityCard,
  SubredditCard,
  TrackedPostCard,
} from "@/lib/types";

type RedditListing = {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        subreddit?: string;
        author?: string;
        permalink?: string;
        score?: number;
        num_comments?: number;
        created_utc?: number;
        removed_by_category?: string | null;
        banned_by?: string | null;
        body?: string;
        replies?: RedditListing | string;
      };
    }>;
  };
};

type RedditThreadPayload = [RedditListing?, unknown?];

type RedditRulesPayload = {
  rules?: Array<{
    short_name?: string;
    description?: string;
    violation_reason?: string;
  }>;
};

type RedditCommentReplyContext = {
  subreddit: string;
  postTitle: string;
  postBody: string;
  commentAuthor: string;
  commentBody: string;
};

type RedditPostCommentContext = {
  subreddit: string;
  postTitle: string;
  postBody: string;
  postAuthor: string;
  topComments: string[];
};

type DiscoverySearchPlan = {
  query: string;
  matchedKeyword: string;
  sort: "new" | "relevance";
  subreddit?: string;
};

const redditHeaders = {
  Accept: "application/json",
  "User-Agent": redditUserAgent,
};

type RedditAccessToken = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

let redditTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | undefined;

export class RedditDiscoveryError extends Error {
  constructor(
    message: string,
    readonly causeDetails: string[] = [],
  ) {
    super(message);
    this.name = "RedditDiscoveryError";
  }
}

async function getRedditAccessToken() {
  if (!isRedditConfigured) {
    return null;
  }

  if (redditTokenCache && redditTokenCache.expiresAt > Date.now() + 30_000) {
    return redditTokenCache.accessToken;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": redditUserAgent,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = (await response.text()).replace(/\s+/g, " ").trim();

    throw new RedditDiscoveryError(
      `Reddit OAuth token request failed with ${response.status} ${response.statusText}`,
      [responseText.slice(0, 180)],
    );
  }

  const payload = (await response.json()) as RedditAccessToken;

  if (!payload.access_token || !payload.expires_in) {
    throw new RedditDiscoveryError("Reddit OAuth token response was invalid.");
  }

  redditTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return redditTokenCache.accessToken;
}

const relevanceStopWords = new Set([
  "about",
  "after",
  "against",
  "also",
  "and",
  "from",
  "have",
  "into",
  "more",
  "that",
  "than",
  "their",
  "there",
  "they",
  "this",
  "actually",
  "build",
  "building",
  "business",
  "customer",
  "customers",
  "helps",
  "product",
  "teams",
  "tool",
  "tools",
  "with",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tokenize(value: string) {
  return (value.toLowerCase().match(/[a-z0-9][a-z0-9+-]{2,}/g) || []).filter(
    (token) => !relevanceStopWords.has(token),
  );
}

function classifyPromoSafety(subreddit: string): SubredditCard["promoTag"] {
  const normalized = subreddit.toLowerCase();

  if (
    normalized.includes("askreddit") ||
    normalized.includes("todayilearned") ||
    normalized.includes("funny") ||
    normalized.includes("news")
  ) {
    return "no self-promo";
  }

  if (
    normalized.includes("startup") ||
    normalized.includes("saas") ||
    normalized.includes("entrepreneur") ||
    normalized.includes("smallbusiness") ||
    normalized.includes("marketing")
  ) {
    return "safe";
  }

  return "risky";
}

function computeIntentScore(input: {
  title: string;
  excerpt: string;
  commentsCount: number;
  score: number;
  keyword: string;
  createdUtc: number;
}) {
  const haystack = `${input.title} ${input.excerpt}`.toLowerCase();
  let total = 18;

  const highIntentPatterns = [
    /alternative/i,
    /recommend/i,
    /looking for/i,
    /need help/i,
    /struggling/i,
    /how do i/i,
    /any tool/i,
    /what.*use/i,
    /best way/i,
  ];

  const painPatterns = [/problem/i, /issue/i, /frustrat/i, /stuck/i, /manual/i];

  if (highIntentPatterns.some((pattern) => pattern.test(haystack))) {
    total += 28;
  }

  if (painPatterns.some((pattern) => pattern.test(haystack))) {
    total += 18;
  }

  if (haystack.includes(input.keyword.toLowerCase())) {
    total += 12;
  }

  total += Math.min(16, Math.round(input.commentsCount * 0.8));
  total += Math.min(12, Math.round(input.score * 0.35));

  const postAgeHours = Math.max(
    0,
    (Date.now() - input.createdUtc * 1000) / 36e5,
  );
  if (postAgeHours <= 6) {
    total += 16;
  } else if (postAgeHours <= 24) {
    total += 10;
  } else if (postAgeHours <= 72) {
    total += 4;
  }

  return clamp(total, 0, 100);
}

function computeRiskScore(subreddit: string, title: string) {
  let risk = 18;
  const promoTag = classifyPromoSafety(subreddit);

  if (promoTag === "risky") {
    risk += 24;
  }

  if (promoTag === "no self-promo") {
    risk += 44;
  }

  if (/rules|ban|self.?promo|promotion/i.test(title)) {
    risk += 14;
  }

  return clamp(risk, 0, 100);
}

function isRemovedListing(item: {
  title?: string;
  selftext?: string;
  removed_by_category?: string | null;
  banned_by?: string | null;
}) {
  if (item.removed_by_category || item.banned_by) {
    return true;
  }

  const title = item.title?.trim().toLowerCase();
  const body = item.selftext?.trim().toLowerCase();

  return title === "[removed]" || body === "[removed]";
}

export async function searchRedditByKeyword(
  keyword: string,
  options?: {
    matchedKeyword?: string;
    sort?: "new" | "relevance";
    subreddit?: string;
  },
) {
  const accessToken = await getRedditAccessToken();
  const subreddit = options?.subreddit?.replace(/^r\//i, "").trim();
  const url = new URL(
    accessToken
      ? subreddit
        ? `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/search`
        : "https://oauth.reddit.com/search"
      : subreddit
        ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`
        : "https://www.reddit.com/search.json",
  );
  url.searchParams.set("q", keyword);
  url.searchParams.set("sort", options?.sort || "relevance");
  url.searchParams.set("limit", "15");
  url.searchParams.set("t", "week");
  url.searchParams.set("type", "link");
  url.searchParams.set("raw_json", "1");

  if (subreddit) {
    url.searchParams.set("restrict_sr", "1");
  }

  const response = await fetch(url, {
    headers: accessToken
      ? {
          ...redditHeaders,
          Authorization: `Bearer ${accessToken}`,
        }
      : redditHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = (await response.text()).replace(/\s+/g, " ").trim();
    const responseSnippet = responseText.slice(0, 180);

    throw new Error(
      `Reddit search failed for keyword \"${keyword}\"${subreddit ? ` in r/${subreddit}` : ""} with ${response.status} ${response.statusText}${responseSnippet ? `: ${responseSnippet}` : ""}`,
    );
  }

  const payload = (await response.json()) as RedditListing;
  const children = payload.data?.children ?? [];

  return children
    .map((child) => child.data)
    .filter((item): item is NonNullable<typeof item> =>
      Boolean(item?.id && item.title && item.subreddit),
    )
    .filter((item) => !isRemovedListing(item))
    .map((item) => {
      const excerpt = (item.selftext || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 260);
      const intentScore = computeIntentScore({
        title: item.title || "",
        excerpt,
        commentsCount: item.num_comments || 0,
        score: item.score || 0,
        keyword,
        createdUtc: item.created_utc || Math.floor(Date.now() / 1000),
      });

      return {
        id: item.id || crypto.randomUUID(),
        keyword: options?.matchedKeyword || keyword,
        title: item.title || "Untitled thread",
        excerpt,
        subreddit: item.subreddit || "unknown",
        author: item.author || "unknown",
        permalink: `https://reddit.com${item.permalink || ""}`,
        score: item.score || 0,
        commentsCount: item.num_comments || 0,
        intentScore,
        riskScore: computeRiskScore(
          item.subreddit || "unknown",
          item.title || "",
        ),
        status: "NEW" as const,
        discoveredAt: new Date(
          (item.created_utc || Math.floor(Date.now() / 1000)) * 1000,
        ).toISOString(),
      } satisfies OpportunityCard;
    });
}

function normalizeRedditThreadUrl(input: string) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!/reddit\.com$/i.test(url.hostname) && !/redd\.it$/i.test(url.hostname)) {
    throw new Error("Enter a valid Reddit post URL.");
  }

  url.hash = "";
  url.search = "";

  if (/redd\.it$/i.test(url.hostname)) {
    url.hostname = "www.reddit.com";
  }

  if (!url.pathname.includes("/comments/")) {
    throw new Error("URL must point to a Reddit post.");
  }

  return url;
}

function normalizeRedditCommentUrl(input: string) {
  const url = normalizeRedditThreadUrl(input);

  if (!/\/comments\/[^/]+\/[^/]+\/[^/]+/i.test(url.pathname)) {
    throw new Error("URL must point to a specific Reddit comment.");
  }

  return url;
}

function findCommentById(
  listing: RedditListing | undefined,
  commentId: string,
): {
  author: string;
  body: string;
} | null {
  const children = listing?.data?.children ?? [];

  for (const child of children) {
    const data = child.data;

    if (!data?.id) {
      continue;
    }

    if (data.id === commentId) {
      return {
        author: data.author || "unknown",
        body: data.body?.trim() || "",
      };
    }

    if (data.replies && typeof data.replies !== "string") {
      const nested = findCommentById(data.replies, commentId);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function extractTopCommentSnippets(listing: RedditListing | undefined) {
  return (listing?.data?.children ?? [])
    .map((child) => child.data)
    .filter((comment) => comment?.body && comment.body !== "[deleted]")
    .sort((left, right) => (right?.score || 0) - (left?.score || 0))
    .slice(0, 4)
    .map((comment) => {
      const author = comment?.author || "unknown";
      const body = (comment?.body || "").replace(/\s+/g, " ").trim();

      return `u/${author}: ${body.slice(0, 360)}`;
    });
}

async function fetchRedditThreadPayload(inputUrl: string, cache: RequestCache) {
  const normalizedUrl = normalizeRedditThreadUrl(inputUrl);
  const apiUrl = new URL(normalizedUrl.toString());
  apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, "")}.json`;

  const response = await fetch(apiUrl, {
    headers: redditHeaders,
    cache,
  });

  if (!response.ok) {
    throw new Error("Could not load that Reddit post.");
  }

  return (await response.json()) as RedditThreadPayload;
}

export async function fetchTrackedRedditPost(
  inputUrl: string,
): Promise<TrackedPostCard> {
  const normalizedUrl = normalizeRedditThreadUrl(inputUrl);
  const apiUrl = new URL(normalizedUrl.toString());
  apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, "")}.json`;

  const response = await fetch(apiUrl, {
    headers: redditHeaders,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error("Could not load that Reddit post.");
  }

  const payload = (await response.json()) as RedditThreadPayload;
  const thread = payload[0]?.data?.children?.[0]?.data;

  if (!thread?.id || !thread.title || !thread.subreddit) {
    throw new Error("Could not parse that Reddit post.");
  }

  return {
    id: thread.id,
    redditId: thread.id,
    title: thread.title,
    subreddit: thread.subreddit,
    author: thread.author || "unknown",
    permalink: `https://reddit.com${thread.permalink || normalizedUrl.pathname}`,
    score: thread.score || 0,
    commentsCount: thread.num_comments || 0,
    postedAt: new Date(
      (thread.created_utc || Math.floor(Date.now() / 1000)) * 1000,
    ).toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };
}

export async function fetchRedditCommentReplyContext(
  postUrlInput: string,
  commentUrlInput: string,
): Promise<RedditCommentReplyContext> {
  const commentUrl = normalizeRedditCommentUrl(commentUrlInput);
  const payload = await fetchRedditThreadPayload(postUrlInput, "no-store");
  const thread = payload[0]?.data?.children?.[0]?.data;

  if (!thread?.title || !thread.subreddit) {
    throw new Error("Could not parse that Reddit post.");
  }

  const commentId =
    commentUrl.pathname
      .replace(/\/$/, "")
      .split("/")
      .filter(Boolean)
      .at(-1) || "";

  if (!commentId) {
    throw new Error("Could not read that Reddit comment URL.");
  }

  const comment = findCommentById(payload[1] as RedditListing | undefined, commentId);

  if (!comment?.body) {
    throw new Error("Could not find that comment in the Reddit thread.");
  }

  return {
    subreddit: thread.subreddit,
    postTitle: thread.title,
    postBody: (thread.selftext || "").trim(),
    commentAuthor: comment.author,
    commentBody: comment.body,
  };
}

export async function fetchRedditPostCommentContext(
  postUrlInput: string,
): Promise<RedditPostCommentContext> {
  const payload = await fetchRedditThreadPayload(postUrlInput, "no-store");
  const thread = payload[0]?.data?.children?.[0]?.data;

  if (!thread?.title || !thread.subreddit) {
    throw new Error("Could not parse that Reddit post.");
  }

  return {
    subreddit: thread.subreddit,
    postTitle: thread.title,
    postBody: (thread.selftext || "").trim(),
    postAuthor: thread.author || "unknown",
    topComments: extractTopCommentSnippets(payload[1] as RedditListing | undefined),
  };
}

export async function fetchSubredditRules(subreddit: string) {
  const url = new URL(`https://www.reddit.com/r/${subreddit}/about/rules.json`);
  const response = await fetch(url, {
    headers: redditHeaders,
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as RedditRulesPayload;

  return (payload.rules || [])
    .map((rule) => {
      const parts = [rule.short_name, rule.description, rule.violation_reason]
        .map((part) => part?.trim())
        .filter(Boolean);

      return parts.join(" — ");
    })
    .filter(Boolean)
    .slice(0, 12);
}

function getProjectPhrases(input: {
  productName: string;
  productDescription: string;
}) {
  const tokens = tokenize(`${input.productName} ${input.productDescription}`);
  const phrases = new Set<string>();

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];

    if (!first || !second) {
      continue;
    }

    phrases.add(`${first} ${second}`);
  }

  for (const token of tokens) {
    if (token.length >= 6) {
      phrases.add(token);
    }
  }

  return Array.from(phrases).slice(0, 6);
}

function expandDiscoveryQueries(input: {
  keywords: string[];
  productName: string;
  productDescription: string;
}) {
  const plans: DiscoverySearchPlan[] = [];
  const projectPhrases = getProjectPhrases(input);

  function addPlan(plan: DiscoverySearchPlan) {
    const normalizedKey = [
      plan.subreddit || "",
      plan.sort,
      plan.query.toLowerCase(),
    ].join(":");

    if (
      plans.some(
        (existing) =>
          [
            existing.subreddit || "",
            existing.sort,
            existing.query.toLowerCase(),
          ].join(":") === normalizedKey,
      )
    ) {
      return;
    }

    plans.push(plan);
  }

  for (const keyword of input.keywords) {
    const trimmed = keyword.trim();

    if (!trimmed) {
      continue;
    }

    addPlan({ query: trimmed, matchedKeyword: trimmed, sort: "relevance" });
    addPlan({ query: trimmed, matchedKeyword: trimmed, sort: "new" });

    addPlan({
      query: `${trimmed} alternative`,
      matchedKeyword: trimmed,
      sort: "relevance",
    });
    addPlan({
      query: `${trimmed} recommend`,
      matchedKeyword: trimmed,
      sort: "relevance",
    });
  }

  for (const phrase of projectPhrases) {
    addPlan({
      query: phrase,
      matchedKeyword: phrase,
      sort: "relevance",
    });
  }

  return plans.slice(0, 14);
}

function buildSubredditFollowupQueries(input: {
  productName: string;
  productDescription: string;
  keywords: string[];
  opportunities: OpportunityCard[];
}) {
  const projectPhrases = getProjectPhrases(input);
  const searchTerms = Array.from(
    new Set([
      ...input.keywords.map((keyword) => keyword.trim()).filter(Boolean),
      ...projectPhrases,
    ]),
  ).slice(0, 4);
  const subredditScores = new Map<string, number>();

  for (const opportunity of input.opportunities) {
    const matchScore = computeProductMatchScore({
      title: opportunity.title,
      excerpt: opportunity.excerpt,
      keyword: opportunity.keyword,
      productName: input.productName,
      productDescription: input.productDescription,
    });
    const score = Math.round(opportunity.intentScore * 0.55 + matchScore * 0.45);
    subredditScores.set(
      opportunity.subreddit,
      Math.max(subredditScores.get(opportunity.subreddit) || 0, score),
    );
  }

  const subreddits = Array.from(subredditScores.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([subreddit]) => subreddit)
    .slice(0, 4);

  return subreddits.flatMap((subreddit) =>
    searchTerms.map((term) => ({
      query: term,
      matchedKeyword: term,
      sort: "new" as const,
      subreddit,
    })),
  );
}

export function computeProductMatchScore(input: {
  title: string;
  excerpt: string;
  keyword: string;
  productName: string;
  productDescription: string;
}) {
  const haystack = `${input.title} ${input.excerpt}`.toLowerCase();
  const contextTokens = new Set(
    tokenize(`${input.productName} ${input.productDescription}`),
  );
  let score = 0;

  for (const token of contextTokens) {
    if (haystack.includes(token)) {
      score += token.length > 6 ? 10 : 6;
    }
  }

  if (haystack.includes(input.keyword.toLowerCase())) {
    score += 16;
  }

  if (/alternative|vs\.?|compare|switch|replace/i.test(haystack)) {
    score += 12;
  }

  if (/struggling|frustrat|manual|pain|problem|inefficient/i.test(haystack)) {
    score += 14;
  }

  return clamp(score, 0, 100);
}

export function filterProjectRelevantOpportunities(input: {
  productName: string;
  productDescription: string;
  opportunities: OpportunityCard[];
}) {
  const scored = input.opportunities.map((opportunity) => ({
    opportunity,
    matchScore: computeProductMatchScore({
      title: opportunity.title,
      excerpt: opportunity.excerpt,
      keyword: opportunity.keyword,
      productName: input.productName,
      productDescription: input.productDescription,
    }),
  }));

  const filtered = scored.filter(({ opportunity, matchScore }) => {
    if (matchScore >= 22) {
      return true;
    }

    return opportunity.intentScore >= 68 && matchScore >= 14;
  });

  return filtered.length
    ? filtered.map(({ opportunity }) => opportunity)
    : scored
        .filter(({ matchScore }) => matchScore >= 12)
        .map(({ opportunity }) => opportunity);
}

export async function discoverOpportunities(input: {
  keywords: string[];
  productName: string;
  productDescription: string;
  excludedSubreddits: string[];
  enableAiReranking?: boolean;
}) {
  const excludedSubreddits = new Set(
    input.excludedSubreddits.map(normalizeSubredditName).filter(Boolean),
  );
  const searchPlans = expandDiscoveryQueries(input);
  const settled = await Promise.allSettled(
    searchPlans.map((plan) =>
      searchRedditByKeyword(plan.query, {
        matchedKeyword: plan.matchedKeyword,
        sort: plan.sort,
        subreddit: plan.subreddit,
      }),
    ),
  );
  const deduped = new Map<string, OpportunityCard>();
  const failures: string[] = [];

  function mergeOpportunities(opportunities: OpportunityCard[]) {
    for (const opportunity of opportunities) {
      if (excludedSubreddits.has(normalizeSubredditName(opportunity.subreddit))) {
        continue;
      }

      const existing = deduped.get(opportunity.id);
      const matchScore = computeProductMatchScore({
        title: opportunity.title,
        excerpt: opportunity.excerpt,
        keyword: opportunity.keyword,
        productName: input.productName,
        productDescription: input.productDescription,
      });
      const rescoredOpportunity = {
        ...opportunity,
        intentScore: clamp(
          Math.round(opportunity.intentScore * 0.58 + matchScore * 0.42),
          0,
          100,
        ),
      };

      if (!existing || existing.intentScore < rescoredOpportunity.intentScore) {
        deduped.set(opportunity.id, rescoredOpportunity);
      }
    }
  }

  for (const result of settled) {
    if (result.status === "fulfilled") {
      mergeOpportunities(result.value);
      continue;
    }

    failures.push(
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason),
    );
  }

  if (failures.length === settled.length && settled.length > 0) {
    throw new RedditDiscoveryError(
      "Reddit discovery failed for every search query.",
      failures,
    );
  }

  const firstPassOpportunities = filterProjectRelevantOpportunities({
    productName: input.productName,
    productDescription: input.productDescription,
    opportunities: Array.from(deduped.values()),
  });
  const followupPlans = buildSubredditFollowupQueries({
    ...input,
    opportunities: firstPassOpportunities,
  }).slice(0, 12);

  if (followupPlans.length) {
    const followupSettled = await Promise.allSettled(
      followupPlans.map((plan) =>
        searchRedditByKeyword(plan.query, {
          matchedKeyword: plan.matchedKeyword,
          sort: plan.sort,
          subreddit: plan.subreddit,
        }),
      ),
    );

    for (const result of followupSettled) {
      if (result.status === "fulfilled") {
        mergeOpportunities(result.value);
        continue;
      }

      failures.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  if (failures.length > 0) {
    console.warn("Partial Reddit discovery failure", {
      queryCount: searchPlans.length + followupPlans.length,
      failedQueryCount: failures.length,
      sampleFailure: failures[0],
    });
  }

  let opportunities = filterProjectRelevantOpportunities({
    productName: input.productName,
    productDescription: input.productDescription,
    opportunities: Array.from(deduped.values()),
  }).sort((left, right) => {
    if (right.intentScore !== left.intentScore) {
      return right.intentScore - left.intentScore;
    }

    return (
      new Date(right.discoveredAt).getTime() -
      new Date(left.discoveredAt).getTime()
    );
  });

  const reranked = input.enableAiReranking !== false
    ? await rerankOpportunityMatches({
        productName: input.productName,
        productDescription: input.productDescription,
        opportunities,
      })
    : null;

  if (reranked?.size) {
    opportunities = opportunities
      .filter((opportunity) => {
        const aiScore = reranked.get(opportunity.id);

        return typeof aiScore !== "number" || aiScore >= 38;
      })
      .sort((left, right) => {
        const leftScore = Math.round(
          left.intentScore * 0.55 + (reranked.get(left.id) || 0) * 0.45,
        );
        const rightScore = Math.round(
          right.intentScore * 0.55 + (reranked.get(right.id) || 0) * 0.45,
        );

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return right.intentScore - left.intentScore;
      });
  }

  return opportunities;
}

export function buildSubredditSummaries(opportunities: OpportunityCard[]) {
  const groups = new Map<string, OpportunityCard[]>();

  for (const opportunity of opportunities) {
    const existing = groups.get(opportunity.subreddit) ?? [];
    existing.push(opportunity);
    groups.set(opportunity.subreddit, existing);
  }

  return Array.from(groups.entries())
    .map(([name, items]) => {
      const averageIntent = Math.round(
        items.reduce((total, item) => total + item.intentScore, 0) /
          items.length,
      );
      const engagementScore = clamp(
        Math.round(
          items.reduce(
            (total, item) => total + item.commentsCount + item.score,
            0,
          ) / items.length,
        ),
        0,
        100,
      );

      return {
        name,
        mentions: items.length,
        averageIntent,
        engagementScore,
        promoTag: classifyPromoSafety(name),
      } satisfies SubredditCard;
    })
    .sort((left, right) => {
      if (right.averageIntent !== left.averageIntent) {
        return right.averageIntent - left.averageIntent;
      }

      return right.mentions - left.mentions;
    })
    .slice(0, 8);
}

export function buildDailyActions(
  opportunities: OpportunityCard[],
  subreddits: SubredditCard[],
) {
  const actionableOpportunities = opportunities.filter(
    (opportunity) =>
      opportunity.status !== "DISMISSED" &&
      opportunity.status !== "REPLIED" &&
      opportunity.intentScore >= 45 &&
      opportunity.riskScore < 70,
  );
  const actionableSubredditNames = new Set(
    actionableOpportunities.map((opportunity) => opportunity.subreddit),
  );
  const commentTargets = actionableOpportunities
    .slice(0, 2)
    .map((opportunity, index) => ({
      id: `comment-${opportunity.id}`,
      type: "COMMENT" as const,
      title:
        index === 0
          ? "Leave your first high-intent reply"
          : "Follow up on a second live thread",
      summary: `${opportunity.title} in r/${opportunity.subreddit}`,
      priority:
        opportunity.intentScore > 70 ? ("high" as const) : ("medium" as const),
      subreddit: opportunity.subreddit,
      opportunityId: opportunity.id,
      permalink: opportunity.permalink,
      subredditUrl: `https://www.reddit.com/r/${opportunity.subreddit}/`,
      riskNote:
        opportunity.riskScore > 45
          ? "Keep this answer educational and avoid a direct product CTA."
          : "A soft CTA is reasonable if you lead with specific advice.",
    }));

  const bestPostingSubreddit =
    subreddits.find(
      (subreddit) =>
        subreddit.promoTag === "safe" &&
        actionableSubredditNames.has(subreddit.name),
    ) ??
    subreddits.find((subreddit) => actionableSubredditNames.has(subreddit.name));
  const postAction = bestPostingSubreddit
    ? [
        {
          id: `post-${bestPostingSubreddit.name}`,
          type: "POST" as const,
          title: "Draft one subreddit-native post",
          summary: `Use a story or question angle tailored to r/${bestPostingSubreddit.name}`,
          priority: "high" as const,
          subreddit: bestPostingSubreddit.name,
          subredditUrl: `https://www.reddit.com/r/${bestPostingSubreddit.name}/`,
          submitUrl: `https://www.reddit.com/r/${bestPostingSubreddit.name}/submit`,
          riskNote:
            bestPostingSubreddit.promoTag === "safe"
              ? "Frame the post around a lesson learned instead of a launch announcement."
              : "Validate the subreddit rules manually before posting.",
        },
      ]
    : [];

  return [...postAction, ...commentTargets].slice(0, 3) satisfies ActionCard[];
}

export function buildAnalytics(
  opportunities: OpportunityCard[],
  subreddits: SubredditCard[],
) {
  const totalOpportunities = opportunities.length;
  const hotLeads = opportunities.filter(
    (opportunity) => opportunity.intentScore >= 75,
  ).length;
  const repliedThreads = opportunities.filter(
    (opportunity) => opportunity.status === "REPLIED",
  ).length;
  const safeSubreddits = subreddits.filter(
    (subreddit) => subreddit.promoTag === "safe",
  ).length;
  const averageIntent = totalOpportunities
    ? Math.round(
        opportunities.reduce(
          (total, opportunity) => total + opportunity.intentScore,
          0,
        ) / totalOpportunities,
      )
    : 0;

  return {
    totalOpportunities,
    hotLeads,
    repliedThreads,
    safeSubreddits,
    averageIntent,
  };
}

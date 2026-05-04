import { isRedditConfigured, redditUserAgent } from "@/lib/config";
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
  "tool",
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

export async function searchRedditByKeyword(keyword: string) {
  const accessToken = await getRedditAccessToken();
  const url = new URL(
    accessToken
      ? "https://oauth.reddit.com/search"
      : "https://www.reddit.com/search.json",
  );
  url.searchParams.set("q", keyword);
  url.searchParams.set("sort", "new");
  url.searchParams.set("limit", "10");
  url.searchParams.set("t", "week");
  url.searchParams.set("type", "link");
  url.searchParams.set("raw_json", "1");

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
      `Reddit search failed for keyword \"${keyword}\" with ${response.status} ${response.statusText}${responseSnippet ? `: ${responseSnippet}` : ""}`,
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
        keyword,
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

function expandDiscoveryQueries(keywords: string[]) {
  const queries: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();

    if (!trimmed) {
      continue;
    }

    queries.push(trimmed);

    if (
      !/alternative|compare|versus|vs|problem|pain|looking for|need help|recommend|best/i.test(
        trimmed,
      )
    ) {
      queries.push(`alternative to ${trimmed}`);
      queries.push(`best ${trimmed}`);
      queries.push(`need help with ${trimmed}`);
    }
  }

  return Array.from(new Set(queries)).slice(0, 12);
}

function computeProductMatchScore(input: {
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

export async function discoverOpportunities(input: {
  keywords: string[];
  productName: string;
  productDescription: string;
}) {
  const queries = expandDiscoveryQueries(input.keywords);
  const settled = await Promise.allSettled(
    queries.map((keyword) => searchRedditByKeyword(keyword)),
  );
  const deduped = new Map<string, OpportunityCard>();
  const failures = settled
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    .map((result) =>
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason),
    );

  if (failures.length === settled.length && settled.length > 0) {
    throw new RedditDiscoveryError(
      "Reddit discovery failed for every search query.",
      failures,
    );
  }

  if (failures.length > 0) {
    console.warn("Partial Reddit discovery failure", {
      queryCount: queries.length,
      failedQueryCount: failures.length,
      sampleFailure: failures[0],
    });
  }

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      continue;
    }

    for (const opportunity of result.value) {
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
          Math.round(opportunity.intentScore * 0.72 + matchScore * 0.28),
          0,
          100,
        ),
      };

      if (!existing || existing.intentScore < rescoredOpportunity.intentScore) {
        deduped.set(opportunity.id, rescoredOpportunity);
      }
    }
  }

  let opportunities = Array.from(deduped.values()).sort((left, right) => {
    if (right.intentScore !== left.intentScore) {
      return right.intentScore - left.intentScore;
    }

    return (
      new Date(right.discoveredAt).getTime() -
      new Date(left.discoveredAt).getTime()
    );
  });

  const reranked = await rerankOpportunityMatches({
    productName: input.productName,
    productDescription: input.productDescription,
    opportunities,
  });

  if (reranked?.size) {
    opportunities = opportunities.sort((left, right) => {
      const leftScore = Math.round(
        left.intentScore * 0.65 + (reranked.get(left.id) || 0) * 0.35,
      );
      const rightScore = Math.round(
        right.intentScore * 0.65 + (reranked.get(right.id) || 0) * 0.35,
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
  const commentTargets = opportunities
    .filter((opportunity) => opportunity.riskScore < 70)
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
    subreddits.find((subreddit) => subreddit.promoTag === "safe") ??
    subreddits[0];
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

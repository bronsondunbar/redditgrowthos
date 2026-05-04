import OpenAI from "openai";

import { isOpenAiConfigured, openAiModel } from "@/lib/config";
import type { OpportunityCard } from "@/lib/types";

type ReplyInput = {
  productName: string;
  productDescription: string;
  subreddit: string;
  title: string;
  excerpt: string;
};

type PostDraftInput = {
  productName: string;
  productDescription: string;
  subreddit: string;
  summary: string;
  riskNote: string;
};

type PostRuleReviewInput = {
  subreddit: string;
  rules: string[];
  title: string;
  body: string;
};

const openai = isOpenAiConfigured
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type WebsiteEnrichmentInput = {
  url: string;
  title: string;
  siteName: string;
  description: string;
  metaKeywords: string;
  bodySnippet: string;
};

type WebsiteEnrichmentResult = {
  productName: string;
  productDescription: string;
  keywords: string[];
};

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeKeywordList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 8);
}

function computeSoftPromotionScore(reply: string) {
  let score = 18;

  if (/book a demo|buy now|limited time|pricing|discount/i.test(reply)) {
    score += 42;
  }

  if (/happy to share|if useful|might help|worth exploring/i.test(reply)) {
    score -= 8;
  }

  if (/http|www\./i.test(reply)) {
    score += 16;
  }

  return Math.min(100, Math.max(0, score));
}

function buildFallbackReply(input: ReplyInput) {
  const firstSentence = `I would start by narrowing the problem into one repeatable workflow instead of trying a full Reddit growth engine at once.`;
  const secondSentence = `For r/${input.subreddit}, an answer that shares one concrete process, one lesson learned, and one metric you track will usually land better than a pitch.`;
  const finalSentence = input.productName
    ? `If it helps, you can mention that you are building ${input.productName} only after you have already answered the question directly.`
    : `If you want to reference your product, keep it to a single sentence after you have already answered the question directly.`;

  return `${firstSentence} ${secondSentence} ${finalSentence}`;
}

function buildFallbackPost(input: PostDraftInput) {
  const title = `What finally improved this workflow for our team`;
  const body = `We kept seeing the same pain point come up around ${input.productDescription.toLowerCase()}.

What helped most was simplifying the workflow first instead of adding more tools or more process.

For us, the useful shift was to document one repeatable loop, decide what signal mattered most, and only then build around that.

Curious how other teams in r/${input.subreddit} handle this today.`;

  return {
    title,
    body,
  };
}

function buildFallbackPostReview(input: PostRuleReviewInput) {
  const combined = `${input.title} ${input.body}`.toLowerCase();
  const issues: string[] = [];

  if (/http|www\./i.test(combined)) {
    issues.push("The draft includes a link, which many subreddits restrict.");
  }

  if (/buy|demo|pricing|discount|signup|sign up/i.test(combined)) {
    issues.push(
      "The draft reads promotional in places and may trigger self-promo rules.",
    );
  }

  return {
    verdict: issues.length ? "review-needed" : "looks-safe",
    summary: issues.length
      ? "No obvious rule match failed automatically, but this draft still needs a manual rules pass."
      : "Nothing in the draft obviously conflicts with the fetched subreddit rules, but you should still verify manually.",
    issues,
  };
}

export async function generateReplySuggestion(input: ReplyInput) {
  const fallbackReply = buildFallbackReply(input);

  if (!openai) {
    return {
      reply: fallbackReply,
      softPromotionScore: computeSoftPromotionScore(fallbackReply),
      source: "template" as const,
    };
  }

  try {
    const response = await openai.responses.create({
      model: openAiModel,
      input: [
        {
          role: "system",
          content:
            "You write concise Reddit replies for founders. Lead with useful advice, avoid hype, and keep self-promotion minimal.",
        },
        {
          role: "user",
          content: `Subreddit: r/${input.subreddit}\nThread title: ${input.title}\nThread excerpt: ${input.excerpt}\nProduct: ${input.productName}\nProduct description: ${input.productDescription}\n\nWrite a 3-4 sentence reply that helps first and mentions the product only if it feels natural.`,
        },
      ],
    });

    const reply = response.output_text?.trim() || fallbackReply;

    return {
      reply,
      softPromotionScore: computeSoftPromotionScore(reply),
      source: "ai" as const,
    };
  } catch {
    return {
      reply: fallbackReply,
      softPromotionScore: computeSoftPromotionScore(fallbackReply),
      source: "template" as const,
    };
  }
}

export async function generatePostSuggestion(input: PostDraftInput) {
  const fallbackDraft = buildFallbackPost(input);

  if (!openai) {
    return {
      ...fallbackDraft,
      source: "template" as const,
    };
  }

  try {
    const response = await openai.responses.create({
      model: openAiModel,
      input: [
        {
          role: "system",
          content:
            "You write subreddit-native Reddit posts for founders. Avoid sounding promotional. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Return JSON with keys title and body.\n\nRules:\n- Write a post that feels native to r/${input.subreddit}.\n- Lead with a concrete lesson, story, or question.\n- Do not include links.\n- Do not mention the product name unless it is necessary, and if used keep it minimal.\n- Body should be 4-7 short paragraphs.\n- Keep the tone useful, candid, and discussion-oriented.\n\nProduct: ${input.productName}\nProduct description: ${input.productDescription}\nAction summary: ${input.summary}\nRisk note: ${input.riskNote}`,
        },
      ],
    });

    const parsed = JSON.parse(stripCodeFence(response.output_text || "{}")) as {
      title?: string;
      body?: string;
    };

    if (!parsed.title?.trim() || !parsed.body?.trim()) {
      return {
        ...fallbackDraft,
        source: "template" as const,
      };
    }

    return {
      title: parsed.title.trim(),
      body: parsed.body.trim(),
      source: "ai" as const,
    };
  } catch {
    return {
      ...fallbackDraft,
      source: "template" as const,
    };
  }
}

export async function reviewPostAgainstRules(input: PostRuleReviewInput) {
  const fallbackReview = buildFallbackPostReview(input);

  if (!openai || !input.rules.length) {
    return fallbackReview;
  }

  try {
    const response = await openai.responses.create({
      model: openAiModel,
      input: [
        {
          role: "system",
          content:
            "You review drafted Reddit posts against subreddit rules. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Return JSON with keys verdict, summary, and issues.\n\nRules:\n- verdict must be one of: looks-safe, review-needed, likely-to-be-removed.\n- summary must be one short sentence.\n- issues must be an array of concise strings.\n- Be conservative. If the rules are ambiguous, prefer review-needed.\n\nSubreddit: r/${input.subreddit}\nRules:\n${input.rules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}\n\nDraft title: ${input.title}\nDraft body: ${input.body}`,
        },
      ],
    });

    const parsed = JSON.parse(stripCodeFence(response.output_text || "{}")) as {
      verdict?: string;
      summary?: string;
      issues?: string[];
    };

    if (!parsed.summary?.trim()) {
      return fallbackReview;
    }

    const verdict =
      parsed.verdict === "likely-to-be-removed" ||
      parsed.verdict === "review-needed" ||
      parsed.verdict === "looks-safe"
        ? parsed.verdict
        : fallbackReview.verdict;

    return {
      verdict,
      summary: parsed.summary.trim(),
      issues: Array.isArray(parsed.issues)
        ? parsed.issues
            .map((issue) => issue.trim())
            .filter(Boolean)
            .slice(0, 5)
        : fallbackReview.issues,
    };
  } catch {
    return fallbackReview;
  }
}

export async function enrichWebsiteIntake(
  input: WebsiteEnrichmentInput,
): Promise<WebsiteEnrichmentResult | null> {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.responses.create({
      model: openAiModel,
      input: [
        {
          role: "system",
          content:
            "You extract structured product positioning from website copy for Reddit growth research. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Analyze this website and return JSON with keys productName, productDescription, and keywords.\n\nRules:\n- productName: short brand or product name.\n- productDescription: one precise sentence explaining what the product does and who it helps.\n- keywords: 6-8 high-intent Reddit discovery phrases, not single generic nouns. Prefer phrases a buyer or frustrated user would actually type, including pain points, alternatives, comparisons, and outcomes.\n- Avoid branded fluff, marketing slogans, and repeated variants.\n\nWebsite URL: ${input.url}\nTitle: ${input.title}\nSite name: ${input.siteName}\nDescription: ${input.description}\nMeta keywords: ${input.metaKeywords}\nBody snippet: ${input.bodySnippet}`,
        },
      ],
    });

    const parsed = JSON.parse(
      stripCodeFence(response.output_text || "{}"),
    ) as Partial<WebsiteEnrichmentResult>;
    const productName = parsed.productName?.trim();
    const productDescription = parsed.productDescription?.trim();
    const keywords = normalizeKeywordList(
      Array.isArray(parsed.keywords) ? parsed.keywords : [],
    );

    if (!productName || !productDescription || !keywords.length) {
      return null;
    }

    return {
      productName,
      productDescription,
      keywords,
    };
  } catch {
    return null;
  }
}

export async function rerankOpportunityMatches(input: {
  productName: string;
  productDescription: string;
  opportunities: OpportunityCard[];
}) {
  if (!openai || !input.opportunities.length) {
    return null;
  }

  try {
    const trimmedOpportunities = input.opportunities
      .slice(0, 20)
      .map((opportunity) => ({
        id: opportunity.id,
        keyword: opportunity.keyword,
        title: opportunity.title,
        excerpt: opportunity.excerpt,
        subreddit: opportunity.subreddit,
      }));

    const response = await openai.responses.create({
      model: openAiModel,
      input: [
        {
          role: "system",
          content:
            "You rank Reddit threads for product-customer fit. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Return JSON with a single key named matches. matches must be an array of objects with keys id and score, where score is 0-100 for how well the Reddit thread matches this product's likely buyers, pain points, or use case.\n\nProduct: ${input.productName}\nProduct description: ${input.productDescription}\n\nThreads: ${JSON.stringify(trimmedOpportunities)}`,
        },
      ],
    });

    const parsed = JSON.parse(stripCodeFence(response.output_text || "{}")) as {
      matches?: Array<{ id?: string; score?: number }>;
    };

    if (!Array.isArray(parsed.matches)) {
      return null;
    }

    return new Map(
      parsed.matches
        .filter(
          (match) =>
            typeof match.id === "string" && typeof match.score === "number",
        )
        .map((match) => [
          match.id as string,
          Math.max(0, Math.min(100, Math.round(match.score as number))),
        ]),
    );
  } catch {
    return null;
  }
}

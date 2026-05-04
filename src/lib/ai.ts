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

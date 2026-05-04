import { enrichWebsiteIntake } from "@/lib/ai";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "be",
  "by",
  "for",
  "from",
  "get",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "your",
]);

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeInputUrl(input: string) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  return parsed.toString();
}

function extractMetaContent(
  html: string,
  key: string,
  attribute: "name" | "property",
) {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return stripTags(match?.[1] || match?.[2] || "");
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(match?.[1] || "");
}

function extractBodySnippet(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = stripTags(bodyMatch?.[1] || html);
  return body.slice(0, 4000);
}

function cleanProductName(value: string) {
  return value
    .split(/[|\-–—:]/)[0]
    .replace(/\b(home|official site|homepage)\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferKeywords(input: {
  productName: string;
  description: string;
  metaKeywords: string;
}) {
  if (input.metaKeywords) {
    return input.metaKeywords
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  const text = `${input.productName} ${input.description}`.toLowerCase();
  const tokens = text.match(/[a-z0-9][a-z0-9+-]{2,}/g) || [];
  const counts = new Map<string, number>();

  for (const token of tokens) {
    if (stopWords.has(token) || /^\d+$/.test(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([token]) => token);
}

export async function extractWebsiteIntake(inputUrl: string) {
  const url = normalizeInputUrl(inputUrl);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "RedditGrowthOS/0.1 (+website-intake)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error("Could not fetch that URL.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error("URL did not return an HTML page.");
  }

  const html = (await response.text()).slice(0, 250000);
  const title = extractTitle(html);
  const ogTitle = extractMetaContent(html, "og:title", "property");
  const siteName = extractMetaContent(html, "og:site_name", "property");
  const description =
    extractMetaContent(html, "description", "name") ||
    extractMetaContent(html, "og:description", "property");
  const metaKeywords = extractMetaContent(html, "keywords", "name");
  const bodySnippet = extractBodySnippet(html);

  const fallbackProductName = cleanProductName(
    siteName || ogTitle || title || new URL(url).hostname.replace(/^www\./, ""),
  );
  const fallbackProductDescription =
    description || `${fallbackProductName} website`;
  const fallbackKeywords = inferKeywords({
    productName: fallbackProductName,
    description: fallbackProductDescription,
    metaKeywords,
  });

  const aiEnrichment = await enrichWebsiteIntake({
    url,
    title,
    siteName,
    description: fallbackProductDescription,
    metaKeywords,
    bodySnippet,
  });

  const productName = aiEnrichment?.productName || fallbackProductName;
  const productDescription =
    aiEnrichment?.productDescription || fallbackProductDescription;
  const keywords = aiEnrichment?.keywords?.length
    ? aiEnrichment.keywords
    : fallbackKeywords;

  return {
    sourceUrl: inputUrl.trim(),
    resolvedUrl: response.url,
    productName,
    productDescription,
    keywords,
  };
}

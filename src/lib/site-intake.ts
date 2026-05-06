import { enrichWebsiteIntake } from "@/lib/ai";

type PageContext = {
  url: string;
  title: string;
  siteName: string;
  description: string;
  metaKeywords: string;
  headings: string[];
  bodySnippet: string;
  structuredDataSnippet: string;
};

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

const websiteIntakeHeaders = {
  "User-Agent": "RedditGrowthOS/0.1 (+website-intake)",
  Accept: "text/html,application/xhtml+xml",
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
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

function uniqueStrings(values: string[]) {
  return values.filter(
    (value, index, array) => value && array.indexOf(value) === index,
  );
}

function extractVisibleTexts(
  html: string,
  tagNames: string[],
  limit: number,
  maxLength = 180,
) {
  const tags = tagNames.join("|");
  const pattern = new RegExp(`<(${tags})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) && values.length < limit * 2) {
    const text = stripTags(match[2] || "");

    if (text.length >= 3) {
      values.push(text.slice(0, maxLength));
    }
  }

  return uniqueStrings(values).slice(0, limit);
}

function collectStructuredDataText(value: unknown, output: string[]) {
  if (output.length >= 24 || value == null) {
    return;
  }

  if (typeof value === "string") {
    const cleaned = stripTags(value);

    if (cleaned.length >= 3 && cleaned.length <= 260) {
      output.push(cleaned);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStructuredDataText(item, output);
    }

    return;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const usefulKeys = [
      "@type",
      "@graph",
      "name",
      "headline",
      "description",
      "slogan",
      "audience",
      "about",
      "brand",
      "category",
      "applicationCategory",
      "mainEntity",
      "offers",
      "provider",
      "serviceType",
    ];

    for (const key of usefulKeys) {
      collectStructuredDataText(record[key], output);
    }
  }
}

function extractStructuredDataSnippet(html: string) {
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) && values.length < 24) {
    try {
      collectStructuredDataText(JSON.parse(match[1] || "{}"), values);
    } catch {
      const fallbackText = stripTags(match[1] || "");

      if (fallbackText) {
        values.push(fallbackText.slice(0, 500));
      }
    }
  }

  return uniqueStrings(values).join(" | ").slice(0, 1800);
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: websiteIntakeHeaders,
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
  return {
    html,
    resolvedUrl: response.url,
  };
}

function extractPageContext(html: string, url: string): PageContext {
  const title = extractTitle(html);
  const ogTitle = extractMetaContent(html, "og:title", "property");
  const siteName = extractMetaContent(html, "og:site_name", "property");
  const description =
    extractMetaContent(html, "description", "name") ||
    extractMetaContent(html, "og:description", "property");
  const metaKeywords = extractMetaContent(html, "keywords", "name");
  const bodySnippet = extractBodySnippet(html);
  const headings = extractVisibleTexts(html, ["h1", "h2", "h3"], 18);
  const structuredDataSnippet = extractStructuredDataSnippet(html);

  return {
    url,
    title: ogTitle || title,
    siteName,
    description,
    metaKeywords,
    headings,
    bodySnippet,
    structuredDataSnippet,
  };
}

function scoreRelatedUrl(url: URL, anchorText: string) {
  const haystack = `${url.pathname} ${anchorText}`.toLowerCase();
  const weightedTerms = [
    ["features", 9],
    ["product", 8],
    ["solutions", 8],
    ["use-cases", 8],
    ["use cases", 8],
    ["customers", 7],
    ["case-studies", 7],
    ["case studies", 7],
    ["pricing", 6],
    ["about", 5],
    ["integrations", 5],
    ["platform", 5],
  ] as const;

  return weightedTerms.reduce(
    (score, [term, weight]) => score + (haystack.includes(term) ? weight : 0),
    0,
  );
}

function extractRelatedUrls(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates = new Map<string, { url: URL; score: number }>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const href = match[1]?.trim();

    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) {
      continue;
    }

    try {
      const url = new URL(href, base);

      if (
        url.origin !== base.origin ||
        !["http:", "https:"].includes(url.protocol)
      ) {
        continue;
      }

      url.hash = "";
      url.search = "";

      if (
        url.pathname === base.pathname ||
        /\.(pdf|png|jpe?g|gif|webp|zip|mp4|mov)$/i.test(url.pathname)
      ) {
        continue;
      }

      const score = scoreRelatedUrl(url, stripTags(match[2] || ""));

      if (score <= 0) {
        continue;
      }

      const key = url.toString();
      const existing = candidates.get(key);

      if (!existing || score > existing.score) {
        candidates.set(key, { url, score });
      }
    } catch {
      continue;
    }
  }

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((candidate) => candidate.url.toString());
}

async function extractRelatedPageContexts(html: string, baseUrl: string) {
  const relatedUrls = extractRelatedUrls(html, baseUrl);
  const results = await Promise.allSettled(
    relatedUrls.map(async (url) => {
      const related = await fetchHtml(url);
      return extractPageContext(related.html, related.resolvedUrl);
    }),
  );

  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

function formatPageContext(page: PageContext, index: number) {
  return [
    `Page ${index + 1}: ${page.url}`,
    page.title ? `Title: ${page.title}` : "",
    page.siteName ? `Site name: ${page.siteName}` : "",
    page.description ? `Description: ${page.description}` : "",
    page.metaKeywords ? `Meta keywords: ${page.metaKeywords}` : "",
    page.headings.length ? `Headings: ${page.headings.join(" | ")}` : "",
    page.structuredDataSnippet
      ? `Structured data: ${page.structuredDataSnippet}`
      : "",
    page.bodySnippet ? `Body copy: ${page.bodySnippet}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function extractWebsiteIntake(inputUrl: string) {
  const url = normalizeInputUrl(inputUrl);
  const homePage = await fetchHtml(url);
  const homeContext = extractPageContext(homePage.html, homePage.resolvedUrl);
  const relatedContexts = await extractRelatedPageContexts(
    homePage.html,
    homePage.resolvedUrl,
  );
  const pageContexts = [homeContext, ...relatedContexts];

  const fallbackProductName = cleanProductName(
    homeContext.siteName ||
      homeContext.title ||
      new URL(homePage.resolvedUrl).hostname.replace(/^www\./, ""),
  );
  const fallbackProductDescription =
    homeContext.description || `${fallbackProductName} website`;
  const fallbackKeywords = inferKeywords({
    productName: fallbackProductName,
    description: fallbackProductDescription,
    metaKeywords: homeContext.metaKeywords,
  });

  const aiEnrichment = await enrichWebsiteIntake({
    url: homePage.resolvedUrl,
    title: homeContext.title,
    siteName: homeContext.siteName,
    description: fallbackProductDescription,
    metaKeywords: homeContext.metaKeywords,
    pageContext: pageContexts.map(formatPageContext).join("\n\n---\n\n"),
  });

  const productName = aiEnrichment?.productName || fallbackProductName;
  const productDescription =
    aiEnrichment?.productDescription || fallbackProductDescription;
  const keywords = aiEnrichment?.keywords?.length
    ? aiEnrichment.keywords
    : fallbackKeywords;

  return {
    sourceUrl: inputUrl.trim(),
    resolvedUrl: homePage.resolvedUrl,
    productName,
    productDescription,
    keywords,
  };
}

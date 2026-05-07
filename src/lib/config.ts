export const appConfig = {
  name: "RedditGrowthOS",
  description:
    "Find customer conversations on Reddit and turn them into a daily execution plan.",
};

const defaultSiteUrl = "http://localhost:3002";

function normalizeSiteUrl(value: string | undefined) {
  if (!value) {
    return defaultSiteUrl;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return defaultSiteUrl;
  }

  if (trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

export const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL,
);

export const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const isOpenAiConfigured = Boolean(process.env.OPENAI_API_KEY);

export const isRedditConfigured = Boolean(
  process.env.REDDIT_CLIENT_ID &&
  process.env.REDDIT_CLIENT_SECRET &&
  process.env.REDDIT_USER_AGENT,
);

export const isResendConfigured = Boolean(
  process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL,
);

export const openAiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export const redditUserAgent =
  process.env.REDDIT_USER_AGENT ||
  "RedditGrowthOS/0.1 (founder workflow discovery)";

export const resendFromEmail = process.env.RESEND_FROM_EMAIL || "";

export const cronSecret = process.env.CRON_SECRET || "";

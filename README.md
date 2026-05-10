# RedditGrowthOS

RedditGrowthOS is an open-source Next.js App Router app for finding live Reddit demand, prioritizing reply opportunities, tracking published Reddit posts, and sending a daily execution digest.

## Why I Open Sourced It

I started building this to help market and generate leads for [ReplyRadar](https://usereplyradar.com/), but that work led to a better product direction. Rather than keep the original internal tool private, I decided to open source it.

[![Buy me a $5 coffee](https://img.shields.io/badge/Buy%20me%20a%20%245%20coffee-support-black?style=for-the-badge)](http://google.com)

> I started working on a tool to help market and get leads for my other projects, but it led to inspiration for a better tool and so I decided to open source it. The tool is called RedditGrowthOS and you can find it here: [this repository](.)

## What It Does

- Creates a multi-project Reddit workspace for products, offers, and campaigns.
- Turns a site URL into an AI-assisted product summary and discovery keyword set.
- Discovers Reddit threads, scores them for relevance and risk, and keeps an action-oriented inbox.
- Tracks published Reddit posts and stores refreshable performance metrics.
- Builds a daily plan with one post plus two reply opportunities and can email that plan on a schedule.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Clerk for auth
- Prisma with Postgres or Neon
- OpenAI for site intake enrichment, reranking, and drafting
- Resend for daily digest delivery
- Vercel cron for scheduled execution

## Quick Start

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Fill in the services you want to enable.
4. Generate Prisma client artifacts.
5. Run migrations.
6. Start the dev server.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

The app runs on `http://localhost:3002` by default.

## Preview Mode

The app can boot without every external service configured. If Clerk, `DATABASE_URL`, or `OPENAI_API_KEY` are missing, the UI still renders in a reduced preview mode so you can inspect the product surface before wiring up auth, persistence, and AI-backed flows.

## Environment Variables

Use `.env.example` as the only committed template. Keep real secrets in your local `.env` file or in your deployment provider's secret store.

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3002"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
DATABASE_URL=""
DIRECT_URL=""
REDDIT_CLIENT_ID=""
REDDIT_CLIENT_SECRET=""
REDDIT_USER_AGENT=""
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
RESEND_API_KEY=""
RESEND_FROM_EMAIL=""
CRON_SECRET=""
```

Notes:

- `NEXT_PUBLIC_SITE_URL` is optional locally and defaults to `http://localhost:3002`.
- `DATABASE_URL` should use Neon's pooled connection string for runtime traffic.
- `DIRECT_URL` should use the non-pooled connection string for Prisma migrations.
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT` should be set for authenticated Reddit discovery in production. Anonymous Reddit search is unreliable from Vercel and may return `403`.
- `RESEND_FROM_EMAIL` must be a verified sender identity in Resend.
- `CRON_SECRET` protects the cron endpoint. Generate one with `openssl rand -base64 32`.

## Reddit API Setup

Production discovery uses Reddit OAuth with the `client_credentials` flow. You need a confidential Reddit app with a client ID, client secret, and a stable user agent.

1. Sign in to the Reddit account that should own the app.
2. Open `https://www.reddit.com/prefs/apps`.
3. Click `create an app` or `create another app`.
4. Give the app a name such as `RedditGrowthOS`.
5. Choose a confidential app type. A `web app` works for this project.
6. If Reddit requires a redirect URI, use a placeholder you control such as `http://localhost:3002/api/reddit/callback`.
7. Save the app.

Map the values like this:

- `REDDIT_CLIENT_ID`: the short ID shown under the app name
- `REDDIT_CLIENT_SECRET`: the value labeled `secret`
- `REDDIT_USER_AGENT`: a descriptive string such as `web:redditgrowthos:v0.1 (by /u/your_reddit_username)`

## Daily Digest Cron

Vercel cron is configured in `vercel.json` to call `/api/cron/daily-digest` once per day at `09:00` UTC.

The route:

- loads each user's projects
- builds Today's 3 actions from live opportunities
- selects the top tracked posts per project
- sends the digest with Resend

It expects this header:

```http
Authorization: Bearer <CRON_SECRET>
```

## Deployment Notes

- Deploy on Vercel.
- Add all application secrets in Vercel project settings rather than committing them.
- Set the Vercel build command to `npm run build:vercel` so deploys apply Prisma migrations before building.
- Set `DATABASE_URL` to the pooled connection and `DIRECT_URL` to the direct connection.
- Configure Clerk, Postgres, and Resend before enabling the cron route in production.

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
```

## Data Model Highlights

- `Project`: workspace container for each product
- `TrackedKeyword`: discovery terms per project
- `Opportunity`: discovered Reddit threads and workflow state
- `TrackedPost`: published Reddit posts with stored metrics and refresh support

## Security

- Real secrets are intentionally excluded from the repository.
- `.env` files are gitignored; only `.env.example` is meant to be committed.
- If you ever commit a credential by mistake, rotate it first and then clean the Git history before publishing the repository.

## License

This project is licensed under the MIT License. See `LICENSE`.

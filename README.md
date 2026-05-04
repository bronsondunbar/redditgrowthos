# RedditGrowthOS

RedditGrowthOS is a Next.js App Router workspace for finding live Reddit demand, prioritizing reply opportunities, tracking published Reddit posts, and sending a daily execution digest.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Clerk for auth
- Prisma + Postgres/Neon
- OpenAI for site intake enrichment, relevance reranking, and reply drafting
- Resend for daily digest emails
- Vercel cron for scheduled email delivery

## Core Features

- Multi-project Reddit workspace
- Website URL intake with AI-assisted product summary and keyword expansion
- Reddit opportunity discovery with intent/risk scoring
- Opportunity inbox with save, unsave, replied, and dismiss workflow states
- Daily action cards for one post plus two replies
- Tracked Reddit posts section for published-post metrics
- Daily email digest with Today's 3 actions and top tracked posts per project

## Environment Variables

Copy [/.env.example](/Users/bronsondunbar/Sites/projects/redditgrowthos/.env.example) to [/.env](/Users/bronsondunbar/Sites/projects/redditgrowthos/.env) and fill in the values:

```env
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

- `DATABASE_URL` should use Neon's pooled connection string for app traffic on Vercel.
- `DIRECT_URL` should use the non-pooled Neon connection string for Prisma migrations.
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT` should be set for authenticated Reddit discovery in production. Anonymous Reddit search is unreliable from Vercel and may return `403`.
- `RESEND_FROM_EMAIL` must be a sender identity verified in Resend.
- `CRON_SECRET` is used to protect the cron endpoint. Generate one with `openssl rand -base64 32`.

## Reddit API Setup

Reddit discovery in production uses Reddit OAuth with the `client_credentials` flow. That means you need a confidential Reddit app with a client ID, client secret, and a specific user agent.

1. Sign in to the Reddit account that should own the app.
2. Open `https://www.reddit.com/prefs/apps`.
3. Click `create an app` or `create another app`.
4. Give the app a name like `RedditGrowthOS`.
5. Choose a confidential app type. A `web app` works for this setup.
6. If Reddit requires a redirect URI, use a placeholder you control such as `http://localhost:3000/api/reddit/callback`. This project does not currently use the redirect URI, but Reddit may still require one during app registration.
7. Save the app.

Map the Reddit app values like this:

- `REDDIT_CLIENT_ID`: the short ID shown under the app name
- `REDDIT_CLIENT_SECRET`: the value labeled `secret`
- `REDDIT_USER_AGENT`: a unique descriptive string for your app, for example `web:redditgrowthos:v0.1 (by /u/your_reddit_username)`

Recommended setup notes:

- Keep the client secret only in server-side env vars such as local `.env` and Vercel project settings.
- Use a real Reddit username in the user agent when possible.
- Add the same Reddit env vars to both local development and Vercel if you want discovery behavior to match across environments.

## Local Development

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npm run db:generate
```

Run migrations locally:

```bash
npm run db:migrate
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
```

## Daily Digest Cron

Vercel cron is configured in [vercel.json](/Users/bronsondunbar/Sites/projects/redditgrowthos/vercel.json):

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This triggers the digest once per day at `09:00` UTC.

The cron route:

- loads each user's projects
- builds Today's 3 actions from live opportunities
- selects the top 3 tracked posts per project
- sends the digest with Resend

The route is protected with `CRON_SECRET` and expects:

```http
Authorization: Bearer <CRON_SECRET>
```

## Deployment Notes

- Deploy on Vercel.
- Add all environment variables in the Vercel project settings.
- Set the Vercel build command to `npm run build:vercel` so deploys apply Prisma migrations before building.
- Set `DATABASE_URL` to the pooled Neon URL and `DIRECT_URL` to the direct Neon URL.
- Create a Reddit app and set `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and a specific `REDDIT_USER_AGENT` in Vercel before relying on discovery in production.
- Make sure Clerk, Postgres, and Resend are all configured before enabling the cron.

## Current Data Model Highlights

- `Project`: workspace container for each product
- `TrackedKeyword`: discovery terms per project
- `Opportunity`: discovered Reddit threads and workflow state
- `TrackedPost`: published Reddit posts with stored metrics and refresh support

## Operational Notes

- Discovery filters out moderator-removed Reddit posts when Reddit exposes removal signals.
- Discovery reruns prune stale `NEW` and `SAVED` opportunities that no longer come back from Reddit.
- Tracked post metrics can be refreshed from the dashboard.

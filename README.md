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
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
RESEND_API_KEY=""
RESEND_FROM_EMAIL=""
CRON_SECRET=""
```

Notes:

- `DATABASE_URL` should point at your Postgres or Neon database.
- `RESEND_FROM_EMAIL` must be a sender identity verified in Resend.
- `CRON_SECRET` is used to protect the cron endpoint. Generate one with `openssl rand -base64 32`.

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
- Run `npm run db:migrate:deploy` against production before relying on scheduled digests.
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

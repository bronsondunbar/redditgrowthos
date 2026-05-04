import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

import {
  cronSecret,
  isClerkConfigured,
  isDatabaseConfigured,
  isResendConfigured,
  resendFromEmail,
} from "@/lib/config";
import { buildDailyDigestEmail } from "@/lib/daily-digest";
import { prisma } from "@/lib/prisma";
import { buildDailyActions, buildSubredditSummaries } from "@/lib/reddit";
import type { OpportunityCard, TrackedPostCard } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

function toOpportunityCard(opportunity: {
  id: string;
  keyword: string;
  title: string;
  excerpt: string;
  subreddit: string;
  author: string | null;
  permalink: string;
  score: number;
  commentsCount: number;
  intentScore: number;
  riskScore: number;
  status: "NEW" | "SAVED" | "REPLIED" | "DISMISSED";
  discoveredAt: Date;
}): OpportunityCard {
  return {
    id: opportunity.id,
    keyword: opportunity.keyword,
    title: opportunity.title,
    excerpt: opportunity.excerpt,
    subreddit: opportunity.subreddit,
    author: opportunity.author || "unknown",
    permalink: opportunity.permalink,
    score: opportunity.score,
    commentsCount: opportunity.commentsCount,
    intentScore: opportunity.intentScore,
    riskScore: opportunity.riskScore,
    status: opportunity.status,
    discoveredAt: opportunity.discoveredAt.toISOString(),
  };
}

function toTrackedPostCard(post: {
  id: string;
  redditId: string;
  title: string;
  subreddit: string;
  author: string | null;
  permalink: string;
  score: number;
  commentsCount: number;
  postedAt: Date;
  lastSyncedAt: Date;
}): TrackedPostCard {
  return {
    id: post.id,
    redditId: post.redditId,
    title: post.title,
    subreddit: post.subreddit,
    author: post.author || "unknown",
    permalink: post.permalink,
    score: post.score,
    commentsCount: post.commentsCount,
    postedAt: post.postedAt.toISOString(),
    lastSyncedAt: post.lastSyncedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorizedResponse();
  }

  if (
    !isClerkConfigured ||
    !isDatabaseConfigured ||
    !isResendConfigured ||
    !prisma ||
    !resend
  ) {
    return Response.json(
      { error: "Clerk, database, or Resend is not configured." },
      { status: 500 },
    );
  }

  const users = await prisma.user.findMany({
    where: {
      projects: {
        some: {},
      },
    },
    select: {
      clerkId: true,
      projects: {
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          websiteUrl: true,
          opportunities: {
            where: {
              status: {
                not: "DISMISSED",
              },
            },
            orderBy: [{ intentScore: "desc" }, { discoveredAt: "desc" }],
            take: 24,
            select: {
              id: true,
              keyword: true,
              title: true,
              excerpt: true,
              subreddit: true,
              author: true,
              permalink: true,
              score: true,
              commentsCount: true,
              intentScore: true,
              riskScore: true,
              status: true,
              discoveredAt: true,
            },
          },
          trackedPosts: {
            orderBy: [
              { score: "desc" },
              { commentsCount: "desc" },
              { postedAt: "desc" },
            ],
            take: 3,
            select: {
              id: true,
              redditId: true,
              title: true,
              subreddit: true,
              author: true,
              permalink: true,
              score: true,
              commentsCount: true,
              postedAt: true,
              lastSyncedAt: true,
            },
          },
        },
      },
    },
  });

  const client = await clerkClient();
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const clerkUser = await client.users
      .getUser(user.clerkId)
      .catch(() => null);
    const recipientEmail =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress;

    if (!recipientEmail) {
      skipped += 1;
      continue;
    }

    const projects = user.projects
      .map((project) => {
        const opportunities = project.opportunities.map(toOpportunityCard);
        const actions = buildDailyActions(
          opportunities,
          buildSubredditSummaries(opportunities),
        ).slice(0, 3);
        const trackedPosts = project.trackedPosts.map(toTrackedPostCard);

        return {
          name: project.name,
          websiteUrl: project.websiteUrl || "",
          actions,
          trackedPosts,
        };
      })
      .filter(
        (project) => project.actions.length || project.trackedPosts.length,
      );

    if (!projects.length) {
      skipped += 1;
      continue;
    }

    const digest = buildDailyDigestEmail({
      recipientName: clerkUser?.firstName || clerkUser?.username || "there",
      projects,
    });

    await resend.emails.send({
      from: resendFromEmail,
      to: recipientEmail,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
    });

    sent += 1;
  }

  return Response.json({ ok: true, sent, skipped });
}

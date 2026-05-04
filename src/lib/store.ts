import { auth } from "@clerk/nextjs/server";
import { OpportunityStatus } from "@prisma/client";

import {
  isClerkConfigured,
  isDatabaseConfigured,
  isOpenAiConfigured,
} from "@/lib/config";
import { prisma } from "@/lib/prisma";
import {
  buildAnalytics,
  buildDailyActions,
  buildSubredditSummaries,
  discoverOpportunities,
} from "@/lib/reddit";
import type {
  DashboardState,
  DiscoveryPayload,
  OpportunityCard,
  ProjectSummary,
  TrackedPostCard,
  WorkflowStatus,
} from "@/lib/types";

function createDashboardState(input: {
  projects: ProjectSummary[];
  currentProjectId: string | null;
  websiteUrl: string;
  productName: string;
  productDescription: string;
  trackedKeywords: string[];
  trackedPosts: TrackedPostCard[];
  opportunities: OpportunityCard[];
  demoMode: boolean;
  requiresAuth: boolean;
}): DashboardState {
  const subreddits = buildSubredditSummaries(input.opportunities);

  return {
    configured: {
      clerk: isClerkConfigured,
      database: isDatabaseConfigured,
      openAi: isOpenAiConfigured,
    },
    demoMode: input.demoMode,
    requiresAuth: input.requiresAuth,
    projects: input.projects,
    currentProjectId: input.currentProjectId,
    websiteUrl: input.websiteUrl,
    productName: input.productName,
    productDescription: input.productDescription,
    trackedKeywords: input.trackedKeywords,
    trackedPosts: input.trackedPosts,
    analytics: buildAnalytics(input.opportunities, subreddits),
    actions: buildDailyActions(input.opportunities, subreddits),
    subreddits,
    opportunities: input.opportunities,
  };
}

function buildEmptyState(
  input?: Partial<Pick<DashboardState, "requiresAuth" | "demoMode">>,
) {
  return createDashboardState({
    projects: [],
    currentProjectId: null,
    websiteUrl: "",
    productName: "RedditGrowthOS",
    productDescription:
      "A Reddit growth workspace for founders that combines opportunity discovery, reply drafting, and a daily action plan.",
    trackedKeywords: [],
    trackedPosts: [],
    opportunities: [],
    demoMode: input?.demoMode ?? false,
    requiresAuth: input?.requiresAuth ?? false,
  });
}

async function ensureUser(clerkId: string) {
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId },
  });
}

function toProjectSummary(project: {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  updatedAt: Date;
  _count: {
    trackedKeywords: number;
    opportunities: number;
  };
}): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description || "",
    websiteUrl: project.websiteUrl || "",
    keywordCount: project._count.trackedKeywords,
    opportunityCount: project._count.opportunities,
    updatedAt: project.updatedAt.toISOString(),
  };
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
  status: OpportunityStatus;
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

export async function getDashboardState(selectedProjectId?: string | null) {
  if (!isClerkConfigured || !isDatabaseConfigured || !prisma) {
    return buildEmptyState();
  }

  const session = await auth();

  if (!session.userId) {
    return buildEmptyState({ requiresAuth: true });
  }

  const user = await ensureUser(session.userId);
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          trackedKeywords: true,
          opportunities: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!projects.length) {
    return buildEmptyState();
  }

  const currentProject =
    projects.find((project) => project.id === selectedProjectId) || projects[0];

  const [keywords, opportunities, trackedPosts] = await Promise.all([
    prisma.trackedKeyword.findMany({
      where: { userId: user.id, projectId: currentProject.id },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
    prisma.opportunity.findMany({
      where: { userId: user.id, projectId: currentProject.id },
      orderBy: [{ intentScore: "desc" }, { discoveredAt: "desc" }],
      take: 24,
    }),
    prisma.trackedPost.findMany({
      where: { userId: user.id, projectId: currentProject.id },
      orderBy: [{ postedAt: "desc" }, { lastSyncedAt: "desc" }],
      take: 12,
    }),
  ]);

  return createDashboardState({
    projects: projects.map(toProjectSummary),
    currentProjectId: currentProject.id,
    websiteUrl: currentProject.websiteUrl || "",
    productName: currentProject.name,
    productDescription: currentProject.description || "",
    trackedKeywords: keywords.map((keyword) => keyword.term),
    trackedPosts: trackedPosts.map(toTrackedPostCard),
    opportunities: opportunities.map(toOpportunityCard),
    demoMode: false,
    requiresAuth: false,
  });
}

export function buildTransientDashboardState(
  payload: DiscoveryPayload,
  opportunities: OpportunityCard[],
) {
  const projectId = payload.projectId || "draft-project";

  return createDashboardState({
    projects: [
      {
        id: projectId,
        name: payload.productName,
        description: payload.productDescription,
        websiteUrl: payload.websiteUrl || "",
        keywordCount: payload.keywords.length,
        opportunityCount: opportunities.length,
        updatedAt: new Date().toISOString(),
      },
    ],
    currentProjectId: projectId,
    websiteUrl: payload.websiteUrl || "",
    productName: payload.productName,
    productDescription: payload.productDescription,
    trackedKeywords: payload.keywords,
    trackedPosts: [],
    opportunities,
    demoMode: !isDatabaseConfigured,
    requiresAuth: false,
  });
}

export async function runDiscovery(payload: DiscoveryPayload) {
  const opportunities = await discoverOpportunities({
    keywords: payload.keywords,
    productName: payload.productName,
    productDescription: payload.productDescription,
  });
  return buildTransientDashboardState(payload, opportunities);
}

export async function persistDiscovery(
  payload: DiscoveryPayload,
  clerkId: string,
  dashboard: DashboardState,
) {
  const db = prisma;

  if (!db) {
    return dashboard;
  }

  const user = await ensureUser(clerkId);
  const existingProject = payload.projectId
    ? await db.project.findFirst({
        where: {
          id: payload.projectId,
          userId: user.id,
        },
      })
    : null;

  const project = existingProject
    ? await db.project.update({
        where: { id: existingProject.id },
        data: {
          name: payload.productName,
          description: payload.productDescription,
          websiteUrl: payload.websiteUrl || null,
        },
      })
    : await db.project.create({
        data: {
          userId: user.id,
          name: payload.productName,
          description: payload.productDescription,
          websiteUrl: payload.websiteUrl || null,
        },
      });

  await db.trackedKeyword.deleteMany({
    where: {
      userId: user.id,
      projectId: project.id,
      term: {
        notIn: payload.keywords,
      },
    },
  });

  await Promise.all(
    payload.keywords.map((term) =>
      db.trackedKeyword.upsert({
        where: { projectId_term: { projectId: project.id, term } },
        update: {},
        create: { userId: user.id, projectId: project.id, term },
      }),
    ),
  );

  await db.opportunity.deleteMany({
    where: {
      userId: user.id,
      projectId: project.id,
      status: {
        in: [OpportunityStatus.NEW, OpportunityStatus.SAVED],
      },
      redditId: {
        notIn: dashboard.opportunities.map((opportunity) => opportunity.id),
      },
    },
  });

  await Promise.all(
    dashboard.opportunities.map((opportunity) =>
      db.opportunity.upsert({
        where: {
          projectId_redditId: {
            projectId: project.id,
            redditId: opportunity.id,
          },
        },
        update: {
          projectId: project.id,
          keyword: opportunity.keyword,
          title: opportunity.title,
          excerpt: opportunity.excerpt,
          subreddit: opportunity.subreddit,
          author: opportunity.author,
          permalink: opportunity.permalink,
          score: opportunity.score,
          commentsCount: opportunity.commentsCount,
          intentScore: opportunity.intentScore,
          riskScore: opportunity.riskScore,
          discoveredAt: new Date(opportunity.discoveredAt),
        },
        create: {
          userId: user.id,
          projectId: project.id,
          redditId: opportunity.id,
          keyword: opportunity.keyword,
          title: opportunity.title,
          excerpt: opportunity.excerpt,
          subreddit: opportunity.subreddit,
          author: opportunity.author,
          permalink: opportunity.permalink,
          score: opportunity.score,
          commentsCount: opportunity.commentsCount,
          intentScore: opportunity.intentScore,
          riskScore: opportunity.riskScore,
          discoveredAt: new Date(opportunity.discoveredAt),
        },
      }),
    ),
  );

  return getDashboardState(project.id);
}

export async function maybeGetClerkUserId() {
  if (!isClerkConfigured) {
    return null;
  }

  const session = await auth();
  return session.userId;
}

export async function updateOpportunityStatus(
  opportunityId: string,
  status: WorkflowStatus,
) {
  if (!isClerkConfigured || !prisma) {
    return false;
  }

  const session = await auth();

  if (!session.userId) {
    return false;
  }

  const user = await ensureUser(session.userId);
  const result = await prisma.opportunity.updateMany({
    where: {
      id: opportunityId,
      userId: user.id,
    },
    data: {
      status,
    },
  });

  return result.count > 0;
}

export async function saveTrackedPost(
  input: {
    projectId?: string | null;
    trackedPost: TrackedPostCard;
  },
  clerkId: string,
) {
  if (!prisma || !input.projectId) {
    return input.trackedPost;
  }

  const user = await ensureUser(clerkId);
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      userId: user.id,
    },
  });

  if (!project) {
    return input.trackedPost;
  }

  const post = await prisma.trackedPost.upsert({
    where: {
      projectId_redditId: {
        projectId: project.id,
        redditId: input.trackedPost.redditId,
      },
    },
    update: {
      title: input.trackedPost.title,
      subreddit: input.trackedPost.subreddit,
      author: input.trackedPost.author,
      permalink: input.trackedPost.permalink,
      score: input.trackedPost.score,
      commentsCount: input.trackedPost.commentsCount,
      postedAt: new Date(input.trackedPost.postedAt),
      lastSyncedAt: new Date(input.trackedPost.lastSyncedAt),
    },
    create: {
      userId: user.id,
      projectId: project.id,
      redditId: input.trackedPost.redditId,
      title: input.trackedPost.title,
      subreddit: input.trackedPost.subreddit,
      author: input.trackedPost.author,
      permalink: input.trackedPost.permalink,
      score: input.trackedPost.score,
      commentsCount: input.trackedPost.commentsCount,
      postedAt: new Date(input.trackedPost.postedAt),
      lastSyncedAt: new Date(input.trackedPost.lastSyncedAt),
    },
  });

  return toTrackedPostCard(post);
}

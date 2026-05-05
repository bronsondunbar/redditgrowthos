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
  PostDraftCard,
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
  postDrafts: PostDraftCard[];
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
    postDrafts: input.postDrafts,
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
    postDrafts: [],
    opportunities: [],
    demoMode: input?.demoMode ?? false,
    requiresAuth: input?.requiresAuth ?? false,
  });
}

export async function ensureUser(clerkId: string) {
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
  replyDraft: string | null;
  replySoftPromotionScore: number;
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
    replyDraft: opportunity.replyDraft || undefined,
    replySoftPromotionScore: opportunity.replySoftPromotionScore,
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

function toPostDraftCard(postDraft: {
  id: string;
  actionKey: string;
  subreddit: string;
  title: string;
  body: string;
  rules: string[];
  reviewVerdict: string;
  reviewSummary: string;
  reviewIssues: string[];
  updatedAt: Date;
}): PostDraftCard {
  return {
    id: postDraft.id,
    actionKey: postDraft.actionKey,
    subreddit: postDraft.subreddit,
    title: postDraft.title,
    body: postDraft.body,
    rules: postDraft.rules,
    review: {
      verdict: postDraft.reviewVerdict as PostDraftCard["review"]["verdict"],
      summary: postDraft.reviewSummary,
      issues: postDraft.reviewIssues,
    },
    updatedAt: postDraft.updatedAt.toISOString(),
  };
}

async function getDashboardStateForUser(
  userId: string,
  selectedProjectId?: string | null,
) {
  if (!prisma) {
    return buildEmptyState();
  }

  const projects = await prisma.project.findMany({
    where: { userId },
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

  const [keywords, opportunities, trackedPosts, postDrafts] = await Promise.all(
    [
      prisma.trackedKeyword.findMany({
        where: { userId, projectId: currentProject.id },
        orderBy: { createdAt: "asc" },
        take: 12,
      }),
      prisma.opportunity.findMany({
        where: { userId, projectId: currentProject.id },
        orderBy: [{ intentScore: "desc" }, { discoveredAt: "desc" }],
        take: 24,
      }),
      prisma.trackedPost.findMany({
        where: { userId, projectId: currentProject.id },
        orderBy: [{ postedAt: "desc" }, { lastSyncedAt: "desc" }],
        take: 12,
      }),
      prisma.postDraft.findMany({
        where: { userId, projectId: currentProject.id },
        orderBy: [{ updatedAt: "desc" }],
        take: 12,
      }),
    ],
  );

  return createDashboardState({
    projects: projects.map(toProjectSummary),
    currentProjectId: currentProject.id,
    websiteUrl: currentProject.websiteUrl || "",
    productName: currentProject.name,
    productDescription: currentProject.description || "",
    trackedKeywords: keywords.map((keyword) => keyword.term),
    trackedPosts: trackedPosts.map(toTrackedPostCard),
    postDrafts: postDrafts.map(toPostDraftCard),
    opportunities: opportunities.map(toOpportunityCard),
    demoMode: false,
    requiresAuth: false,
  });
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
  return getDashboardStateForUser(user.id, selectedProjectId);
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
    postDrafts: [],
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

async function persistProjectDiscovery(input: {
  userId: string;
  projectId: string;
  payload: DiscoveryPayload;
  dashboard: DashboardState;
}) {
  const db = prisma;

  if (!db) {
    return input.dashboard;
  }

  await db.trackedKeyword.deleteMany({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      term: {
        notIn: input.payload.keywords,
      },
    },
  });

  await Promise.all(
    input.payload.keywords.map((term) =>
      db.trackedKeyword.upsert({
        where: { projectId_term: { projectId: input.projectId, term } },
        update: {},
        create: { userId: input.userId, projectId: input.projectId, term },
      }),
    ),
  );

  await db.opportunity.deleteMany({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      status: {
        in: [OpportunityStatus.NEW, OpportunityStatus.SAVED],
      },
      redditId: {
        notIn: input.dashboard.opportunities.map(
          (opportunity) => opportunity.id,
        ),
      },
    },
  });

  await Promise.all(
    input.dashboard.opportunities.map((opportunity) =>
      db.opportunity.upsert({
        where: {
          projectId_redditId: {
            projectId: input.projectId,
            redditId: opportunity.id,
          },
        },
        update: {
          projectId: input.projectId,
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
          userId: input.userId,
          projectId: input.projectId,
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

  return getDashboardStateForUser(input.userId, input.projectId);
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

  return persistProjectDiscovery({
    userId: user.id,
    projectId: project.id,
    payload,
    dashboard,
  });
}

export async function refreshProjectDiscovery(
  projectId: string,
  userId: string,
) {
  if (!prisma) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      websiteUrl: true,
      trackedKeywords: {
        orderBy: { createdAt: "asc" },
        select: {
          term: true,
        },
        take: 12,
      },
    },
  });

  if (!project) {
    return null;
  }

  const payload: DiscoveryPayload = {
    projectId: project.id,
    websiteUrl: project.websiteUrl || "",
    productName: project.name,
    productDescription: project.description || "",
    keywords: project.trackedKeywords.map((keyword) => keyword.term),
  };

  if (!payload.keywords.length) {
    return getDashboardStateForUser(userId, project.id);
  }

  const dashboard = await runDiscovery(payload);

  return persistProjectDiscovery({
    userId,
    projectId: project.id,
    payload,
    dashboard,
  });
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

export async function deleteTrackedPost(
  trackedPostId: string,
  clerkId: string,
) {
  if (!prisma) {
    return false;
  }

  const user = await ensureUser(clerkId);
  const result = await prisma.trackedPost.deleteMany({
    where: {
      id: trackedPostId,
      userId: user.id,
    },
  });

  return result.count > 0;
}

export async function savePostDraft(
  input: {
    projectId?: string | null;
    actionKey: string;
    subreddit: string;
    title: string;
    body: string;
    rules: string[];
    review: PostDraftCard["review"];
  },
  clerkId: string,
) {
  if (!prisma || !input.projectId) {
    return null;
  }

  const user = await ensureUser(clerkId);
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      userId: user.id,
    },
  });

  if (!project) {
    return null;
  }

  const postDraft = await prisma.postDraft.upsert({
    where: {
      projectId_actionKey: {
        projectId: project.id,
        actionKey: input.actionKey,
      },
    },
    update: {
      subreddit: input.subreddit,
      title: input.title,
      body: input.body,
      rules: input.rules,
      reviewVerdict: input.review.verdict,
      reviewSummary: input.review.summary,
      reviewIssues: input.review.issues,
    },
    create: {
      userId: user.id,
      projectId: project.id,
      actionKey: input.actionKey,
      subreddit: input.subreddit,
      title: input.title,
      body: input.body,
      rules: input.rules,
      reviewVerdict: input.review.verdict,
      reviewSummary: input.review.summary,
      reviewIssues: input.review.issues,
    },
  });

  return toPostDraftCard(postDraft);
}

export async function deletePostDraft(postDraftId: string, clerkId: string) {
  if (!prisma) {
    return false;
  }

  const user = await ensureUser(clerkId);
  const result = await prisma.postDraft.deleteMany({
    where: {
      id: postDraftId,
      userId: user.id,
    },
  });

  return result.count > 0;
}

export async function saveReplyDraft(
  input: {
    opportunityId?: string | null;
    reply: string;
    softPromotionScore: number;
  },
  clerkId: string,
) {
  if (!prisma || !input.opportunityId) {
    return null;
  }

  const user = await ensureUser(clerkId);
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: input.opportunityId,
      userId: user.id,
    },
  });

  if (!opportunity) {
    return null;
  }

  const updatedOpportunity = await prisma.opportunity.update({
    where: {
      id: opportunity.id,
    },
    data: {
      replyDraft: input.reply,
      replySoftPromotionScore: input.softPromotionScore,
    },
  });

  return toOpportunityCard(updatedOpportunity);
}

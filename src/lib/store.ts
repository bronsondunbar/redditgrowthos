import { auth } from "@clerk/nextjs/server";
import { OpportunityStatus, Prisma } from "@prisma/client";

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
  filterProjectRelevantOpportunities,
} from "@/lib/reddit";
import type {
  ActionCard,
  DashboardState,
  DiscoveryMode,
  DiscoveryPayload,
  OpportunityCard,
  PostDraftCard,
  ProjectSummary,
  TrackedPostCard,
  WorkflowStatus,
} from "@/lib/types";

function getDailyActionDate(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function filterCompletedActions(
  actions: ActionCard[],
  completedActionIds?: Set<string>,
) {
  if (!completedActionIds?.size) {
    return actions;
  }

  return actions.filter((action) => !completedActionIds.has(action.id));
}

function createDashboardState(input: {
  projects: ProjectSummary[];
  currentProjectId: string | null;
  websiteUrl: string;
  productName: string;
  productDescription: string;
  discoveryMode: DiscoveryMode;
  excludedSubreddits: string[];
  trackedKeywords: string[];
  trackedPosts: TrackedPostCard[];
  postDrafts: PostDraftCard[];
  opportunities: OpportunityCard[];
  completedActionIds?: Set<string>;
  demoMode: boolean;
  requiresAuth: boolean;
}): DashboardState {
  const opportunities = filterProjectRelevantOpportunities({
    productName: input.productName,
    productDescription: input.productDescription,
    opportunities: input.opportunities,
  });
  const subreddits = buildSubredditSummaries(opportunities);
  const actions = buildDailyActions(opportunities, subreddits);

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
    discoveryMode: input.discoveryMode,
    excludedSubreddits: input.excludedSubreddits,
    trackedKeywords: input.trackedKeywords,
    trackedPosts: input.trackedPosts,
    postDrafts: input.postDrafts,
    analytics: buildAnalytics(opportunities, subreddits),
    actions: filterCompletedActions(actions, input.completedActionIds),
    subreddits,
    opportunities,
  };
}

function buildEmptyState(
  input?: Partial<
    Pick<
      DashboardState,
      "requiresAuth" | "demoMode" | "excludedSubreddits" | "discoveryMode"
    >
  >,
) {
  return createDashboardState({
    projects: [],
    currentProjectId: null,
    websiteUrl: "",
    productName: "RedditGrowthOS",
    productDescription:
      "A Reddit growth workspace for founders that combines opportunity discovery, reply drafting, and a daily action plan.",
    discoveryMode:
      input?.discoveryMode ||
      (isOpenAiConfigured ? "AI_ASSISTED" : "REDDIT_API"),
    excludedSubreddits: input?.excludedSubreddits ?? [],
    trackedKeywords: [],
    trackedPosts: [],
    postDrafts: [],
    opportunities: [],
    demoMode: input?.demoMode ?? false,
    requiresAuth: input?.requiresAuth ?? false,
  });
}

export class DiscoveryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryConfigurationError";
  }
}

export async function ensureUser(clerkId: string) {
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, excludedSubreddits: [] },
  });
}

function toProjectSummary(project: {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  discoveryMode: DiscoveryMode;
  lastDiscoveryAt: Date | null;
  updatedAt: Date;
  _count: {
    trackedKeywords: number;
    opportunities: number;
  };
}): ProjectSummary {
  const lastDiscoveryAt =
    project.lastDiscoveryAt ||
    (project._count.opportunities > 0 ? project.updatedAt : null);

  return {
    id: project.id,
    name: project.name,
    description: project.description || "",
    websiteUrl: project.websiteUrl || "",
    discoveryMode: project.discoveryMode,
    lastDiscoveryAt: lastDiscoveryAt?.toISOString() || null,
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      excludedSubreddits: true,
    },
  });

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
    return buildEmptyState({
      excludedSubreddits: user?.excludedSubreddits || [],
    });
  }

  const currentProject =
    projects.find((project) => project.id === selectedProjectId) || projects[0];

  const [keywords, opportunities, trackedPosts, postDrafts, completions] =
    await Promise.all([
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
      prisma.dailyActionCompletion.findMany({
        where: {
          userId,
          projectId: currentProject.id,
          actionDate: getDailyActionDate(),
        },
        select: {
          actionId: true,
        },
      }),
    ]);

  return createDashboardState({
    projects: projects.map(toProjectSummary),
    currentProjectId: currentProject.id,
    websiteUrl: currentProject.websiteUrl || "",
    productName: currentProject.name,
    productDescription: currentProject.description || "",
    discoveryMode: currentProject.discoveryMode,
    excludedSubreddits: user?.excludedSubreddits || [],
    trackedKeywords: keywords.map((keyword) => keyword.term),
    trackedPosts: trackedPosts.map(toTrackedPostCard),
    postDrafts: postDrafts.map(toPostDraftCard),
    opportunities: opportunities.map(toOpportunityCard),
    completedActionIds: new Set(
      completions.map((completion) => completion.actionId),
    ),
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
        discoveryMode: payload.discoveryMode,
        lastDiscoveryAt: new Date().toISOString(),
        keywordCount: payload.keywords.length,
        opportunityCount: opportunities.length,
        updatedAt: new Date().toISOString(),
      },
    ],
    currentProjectId: projectId,
    websiteUrl: payload.websiteUrl || "",
    productName: payload.productName,
    productDescription: payload.productDescription,
    discoveryMode: payload.discoveryMode,
    excludedSubreddits: payload.excludedSubreddits,
    trackedKeywords: payload.keywords,
    trackedPosts: [],
    postDrafts: [],
    opportunities,
    demoMode: !isDatabaseConfigured,
    requiresAuth: false,
  });
}

export async function runDiscovery(payload: DiscoveryPayload) {
  if (payload.discoveryMode === "AI_ASSISTED" && !isOpenAiConfigured) {
    throw new DiscoveryConfigurationError(
      "AI-assisted discovery requires OPENAI_API_KEY. Switch to Reddit APIs only or configure OpenAI first.",
    );
  }

  const opportunities = await discoverOpportunities({
    keywords: payload.keywords,
    productName: payload.productName,
    productDescription: payload.productDescription,
    excludedSubreddits: payload.excludedSubreddits,
    enableAiReranking: payload.discoveryMode === "AI_ASSISTED",
  });
  return buildTransientDashboardState(payload, opportunities);
}

async function persistProjectDiscoveryRecords(
  db: Prisma.TransactionClient,
  input: {
    userId: string;
    projectId: string;
    payload: DiscoveryPayload;
    dashboard: DashboardState;
  },
) {
  const discoveryCompletedAt = new Date();

  await db.dailyActionCompletion.deleteMany({
    where: {
      userId: input.userId,
      projectId: input.projectId,
    },
  });

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

  await db.project.updateMany({
    where: {
      id: input.projectId,
      userId: input.userId,
    },
    data: {
      lastDiscoveryAt: discoveryCompletedAt,
    },
  });
}

async function persistProjectDiscovery(input: {
  userId: string;
  projectId: string;
  payload: DiscoveryPayload;
  dashboard: DashboardState;
}) {
  if (!prisma) {
    return input.dashboard;
  }

  await prisma.$transaction((tx) => persistProjectDiscoveryRecords(tx, input));
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
  const projectId = await db.$transaction(async (tx) => {
    const existingProject = payload.projectId
      ? await tx.project.findFirst({
          where: {
            id: payload.projectId,
            userId: user.id,
          },
        })
      : null;

    const project = existingProject
      ? await tx.project.update({
          where: { id: existingProject.id },
          data: {
            name: payload.productName,
            description: payload.productDescription,
            websiteUrl: payload.websiteUrl || null,
            discoveryMode: payload.discoveryMode,
          },
        })
      : await tx.project.create({
          data: {
            userId: user.id,
            name: payload.productName,
            description: payload.productDescription,
            websiteUrl: payload.websiteUrl || null,
            discoveryMode: payload.discoveryMode,
          },
        });

    await tx.user.update({
      where: { id: user.id },
      data: {
        excludedSubreddits: payload.excludedSubreddits,
      },
    });

    await persistProjectDiscoveryRecords(tx, {
      userId: user.id,
      projectId: project.id,
      payload,
      dashboard,
    });

    return project.id;
  });

  return getDashboardStateForUser(user.id, projectId);
}

export async function deleteProject(projectId: string, clerkId: string) {
  if (!prisma) {
    return null;
  }

  const user = await ensureUser(clerkId);
  const result = await prisma.project.deleteMany({
    where: {
      id: projectId,
      userId: user.id,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return getDashboardStateForUser(user.id);
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
      discoveryMode: true,
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { excludedSubreddits: true },
  });

  const payload: DiscoveryPayload = {
    projectId: project.id,
    websiteUrl: project.websiteUrl || "",
    productName: project.name,
    productDescription: project.description || "",
    discoveryMode: project.discoveryMode,
    excludedSubreddits: user?.excludedSubreddits || [],
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

export async function refreshAllProjectDiscoveries(
  userId: string,
  selectedProjectId?: string | null,
) {
  if (!prisma) {
    return null;
  }

  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!projects.length) {
    return getDashboardStateForUser(userId, selectedProjectId);
  }

  for (const project of projects) {
    await refreshProjectDiscovery(project.id, userId);
  }

  return getDashboardStateForUser(userId, selectedProjectId);
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

export async function completeDailyAction(input: {
  userId: string;
  projectId: string;
  actionId: string;
  opportunityId?: string | null;
  opportunityStatus?: WorkflowStatus;
}) {
  if (!prisma) {
    return false;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      userId: input.userId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return false;
  }

  const actionDate = getDailyActionDate();

  await prisma.$transaction(async (tx) => {
    await tx.dailyActionCompletion.upsert({
      where: {
        projectId_actionId_actionDate: {
          projectId: project.id,
          actionId: input.actionId,
          actionDate,
        },
      },
      update: {
        completedAt: new Date(),
      },
      create: {
        userId: input.userId,
        projectId: project.id,
        actionId: input.actionId,
        actionDate,
      },
    });

    if (!input.opportunityId || !input.opportunityStatus) {
      return;
    }

    const opportunityUpdate = await tx.opportunity.updateMany({
      where: {
        id: input.opportunityId,
        userId: input.userId,
        projectId: project.id,
      },
      data: {
        status: input.opportunityStatus,
      },
    });

    if (opportunityUpdate.count === 0) {
      throw new Error("Linked opportunity not found.");
    }
  });

  return true;
}

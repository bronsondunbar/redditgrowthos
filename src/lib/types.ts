export type WorkflowStatus = "NEW" | "SAVED" | "REPLIED" | "DISMISSED";

export type OpportunityCard = {
  id: string;
  keyword: string;
  title: string;
  excerpt: string;
  subreddit: string;
  author: string;
  permalink: string;
  score: number;
  commentsCount: number;
  intentScore: number;
  riskScore: number;
  replyDraft?: string;
  replySoftPromotionScore?: number;
  status: WorkflowStatus;
  discoveredAt: string;
};

export type SubredditCard = {
  name: string;
  mentions: number;
  averageIntent: number;
  engagementScore: number;
  promoTag: "safe" | "risky" | "no self-promo";
};

export type ActionCard = {
  id: string;
  type: "POST" | "COMMENT";
  title: string;
  summary: string;
  priority: "high" | "medium";
  subreddit: string;
  riskNote: string;
  opportunityId?: string;
  permalink?: string;
  subredditUrl?: string;
  submitUrl?: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  lastDiscoveryAt: string | null;
  keywordCount: number;
  opportunityCount: number;
  updatedAt: string;
};

export type TrackedPostCard = {
  id: string;
  redditId: string;
  title: string;
  subreddit: string;
  author: string;
  permalink: string;
  score: number;
  commentsCount: number;
  postedAt: string;
  lastSyncedAt: string;
};

export type PostDraftCard = {
  id: string;
  actionKey: string;
  subreddit: string;
  title: string;
  body: string;
  rules: string[];
  review: {
    verdict: "looks-safe" | "review-needed" | "likely-to-be-removed";
    summary: string;
    issues: string[];
  };
  updatedAt: string;
};

export type DashboardState = {
  configured: {
    clerk: boolean;
    database: boolean;
    openAi: boolean;
  };
  demoMode: boolean;
  requiresAuth: boolean;
  projects: ProjectSummary[];
  currentProjectId: string | null;
  websiteUrl: string;
  productName: string;
  productDescription: string;
  trackedKeywords: string[];
  analytics: {
    totalOpportunities: number;
    hotLeads: number;
    repliedThreads: number;
    safeSubreddits: number;
    averageIntent: number;
  };
  trackedPosts: TrackedPostCard[];
  postDrafts: PostDraftCard[];
  actions: ActionCard[];
  subreddits: SubredditCard[];
  opportunities: OpportunityCard[];
};

export type DiscoveryPayload = {
  projectId?: string | null;
  websiteUrl?: string;
  productName: string;
  productDescription: string;
  keywords: string[];
};

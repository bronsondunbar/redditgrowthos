"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import type {
  ActionCard,
  DashboardState,
  OpportunityCard,
  PostDraftCard,
  TrackedPostCard,
  WorkflowStatus,
} from "@/lib/types";

type WorkbenchProps = {
  initialState: DashboardState;
};

const metricCards = [
  {
    key: "totalOpportunities",
    label: "Opportunities",
  },
  {
    key: "hotLeads",
    label: "Hot leads",
  },
  {
    key: "repliedThreads",
    label: "Replied",
  },
  {
    key: "safeSubreddits",
    label: "Safe subs",
  },
  {
    key: "averageIntent",
    label: "Avg intent",
  },
] as const;

type ProjectFormState = {
  projectId: string | null;
  websiteUrl: string;
  productName: string;
  productDescription: string;
  keywords: string;
};

type OpportunityFilter = "high" | "low";
type ReplyStateFilter = "not-replied" | "replied";
type WorkspaceToolPanel = "comment" | "drafts" | "reply" | "tracking";
type PostDraftState = Record<
  string,
  {
    title: string;
    body: string;
    rules: string[];
    review: {
      verdict: "looks-safe" | "review-needed" | "likely-to-be-removed";
      summary: string;
      issues: string[];
    };
  }
>;

type PostDraftPanelState = {
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
  updatedAt?: string;
};

type CommentReplyComposerState = {
  postUrl: string;
  commentUrl: string;
};

type PostCommentComposerState = {
  postUrl: string;
};

type GeneratedCommentReplyState = {
  reply: string;
  softPromotionScore: number;
  subreddit: string;
  postTitle: string;
  commentAuthor: string;
  commentBody: string;
};

type GeneratedPostCommentState = {
  comment: string;
  softPromotionScore: number;
  subreddit: string;
  postTitle: string;
  postAuthor: string;
  postBody: string;
};

function getDefaultOpportunityFilter(opportunities: OpportunityCard[]) {
  return opportunities.some(
    (opportunity) =>
      opportunity.status !== "DISMISSED" && opportunity.intentScore >= 70,
  )
    ? "high"
    : "low";
}

function buildFormState(state: DashboardState): ProjectFormState {
  return {
    projectId: state.currentProjectId,
    websiteUrl: state.websiteUrl,
    productName: state.productName,
    productDescription: state.productDescription,
    keywords: state.trackedKeywords.join(", "),
  };
}

function buildPostDraftState(postDrafts: PostDraftCard[]): PostDraftState {
  return Object.fromEntries(
    postDrafts.map((postDraft) => [
      postDraft.actionKey,
      {
        title: postDraft.title,
        body: postDraft.body,
        rules: postDraft.rules,
        review: postDraft.review,
      },
    ]),
  );
}

function buildReplyDraftState(opportunities: OpportunityCard[]) {
  return Object.fromEntries(
    opportunities
      .filter((opportunity) => Boolean(opportunity.replyDraft))
      .map((opportunity) => [opportunity.id, opportunity.replyDraft!]),
  );
}

function buildReplyScoreState(opportunities: OpportunityCard[]) {
  return Object.fromEntries(
    opportunities
      .filter((opportunity) => Boolean(opportunity.replyDraft))
      .map((opportunity) => [
        opportunity.id,
        opportunity.replySoftPromotionScore || 0,
      ]),
  );
}

function upsertPostDraftList(
  postDrafts: PostDraftCard[],
  nextPostDraft: PostDraftCard,
) {
  return [
    nextPostDraft,
    ...postDrafts.filter(
      (postDraft) => postDraft.actionKey !== nextPostDraft.actionKey,
    ),
  ]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    )
    .slice(0, 12);
}

function buildEmptyProjectForm(): ProjectFormState {
  return {
    projectId: null,
    websiteUrl: "",
    productName: "",
    productDescription: "",
    keywords: "",
  };
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildFaviconUrl(websiteUrl: string) {
  const trimmed = websiteUrl.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(normalizedUrl);

    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url.origin)}`;
  } catch {
    return null;
  }
}

function buildSubredditSubmitPath(subreddit: string) {
  return `https://www.reddit.com/r/${subreddit}/submit`;
}

function isSavedStatus(status: WorkflowStatus) {
  return status === "SAVED" || status === "REPLIED";
}

function upsertTrackedPostList(
  trackedPosts: TrackedPostCard[],
  nextTrackedPost: TrackedPostCard,
) {
  return [
    nextTrackedPost,
    ...trackedPosts.filter(
      (post) => post.redditId !== nextTrackedPost.redditId,
    ),
  ]
    .sort(
      (left, right) =>
        new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
    )
    .slice(0, 12);
}

function buildEmptyCommentReplyComposer(): CommentReplyComposerState {
  return {
    postUrl: "",
    commentUrl: "",
  };
}

function buildEmptyPostCommentComposer(): PostCommentComposerState {
  return {
    postUrl: "",
  };
}

export function OpportunityWorkbench({ initialState }: WorkbenchProps) {
  const router = useRouter();
  const isLocalDevelopment = process.env.NODE_ENV !== "production";
  const [dashboard, setDashboard] = useState(initialState);
  const [composerMode, setComposerMode] = useState<"create" | "edit" | null>(
    initialState.projects.length ? null : "create",
  );
  const [form, setForm] = useState<ProjectFormState>(
    buildFormState(initialState),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>(() =>
    buildReplyDraftState(initialState.opportunities),
  );
  const [replyScores, setReplyScores] = useState<Record<string, number>>(() =>
    buildReplyScoreState(initialState.opportunities),
  );
  const [postDrafts, setPostDrafts] = useState<PostDraftState>(() =>
    buildPostDraftState(initialState.postDrafts),
  );
  const [activePostDraft, setActivePostDraft] =
    useState<PostDraftPanelState | null>(null);
  const [copiedDraftKey, setCopiedDraftKey] = useState<string | null>(null);
  const [busyOpportunityId, setBusyOpportunityId] = useState<string | null>(
    null,
  );
  const [busyPostActionId, setBusyPostActionId] = useState<string | null>(null);
  const [completingActionId, setCompletingActionId] = useState<string | null>(
    null,
  );
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isRefreshingDiscovery, setIsRefreshingDiscovery] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [trackedPostUrl, setTrackedPostUrl] = useState("");
  const [isTrackingPost, setIsTrackingPost] = useState(false);
  const [busyTrackedPostId, setBusyTrackedPostId] = useState<string | null>(
    null,
  );
  const [deletingTrackedPostId, setDeletingTrackedPostId] = useState<
    string | null
  >(null);
  const [deletingPostDraftId, setDeletingPostDraftId] = useState<string | null>(
    null,
  );
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [commentReplyComposer, setCommentReplyComposer] =
    useState<CommentReplyComposerState>(buildEmptyCommentReplyComposer);
  const [postCommentComposer, setPostCommentComposer] =
    useState<PostCommentComposerState>(buildEmptyPostCommentComposer);
  const [isGeneratingCommentReply, setIsGeneratingCommentReply] =
    useState(false);
  const [isGeneratingPostComment, setIsGeneratingPostComment] =
    useState(false);
  const [generatedCommentReply, setGeneratedCommentReply] =
    useState<GeneratedCommentReplyState | null>(null);
  const [generatedPostComment, setGeneratedPostComment] =
    useState<GeneratedPostCommentState | null>(null);
  const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>(
    getDefaultOpportunityFilter(initialState.opportunities),
  );
  const [replyStateFilter, setReplyStateFilter] =
    useState<ReplyStateFilter>("not-replied");
  const [activeWorkspaceTool, setActiveWorkspaceTool] =
    useState<WorkspaceToolPanel | null>(null);
  const currentProject = useMemo(
    () =>
      dashboard.projects.find(
        (project) => project.id === dashboard.currentProjectId,
      ) || null,
    [dashboard.currentProjectId, dashboard.projects],
  );
  const opportunityById = useMemo(
    () =>
      new Map(
        dashboard.opportunities.map((opportunity) => [
          opportunity.id,
          opportunity,
        ]),
      ),
    [dashboard.opportunities],
  );
  const hasActions = dashboard.actions.length > 0;
  const hasSavedPostDrafts = dashboard.postDrafts.length > 0;
  const hasSubreddits = dashboard.subreddits.length > 0;
  const hasTrackedPosts = dashboard.trackedPosts.length > 0;
  const trackedPostTotals = useMemo(
    () => ({
      count: dashboard.trackedPosts.length,
      totalScore: dashboard.trackedPosts.reduce(
        (total, post) => total + post.score,
        0,
      ),
      totalComments: dashboard.trackedPosts.reduce(
        (total, post) => total + post.commentsCount,
        0,
      ),
    }),
    [dashboard.trackedPosts],
  );
  const opportunityCounts = useMemo(
    () => ({
      high: dashboard.opportunities.filter(
        (opportunity) =>
          opportunity.status !== "DISMISSED" && opportunity.intentScore >= 70,
      ).length,
      low: dashboard.opportunities.filter(
        (opportunity) =>
          opportunity.status !== "DISMISSED" && opportunity.intentScore < 70,
      ).length,
      notReplied: dashboard.opportunities.filter(
        (opportunity) =>
          opportunity.status !== "DISMISSED" &&
          opportunity.status !== "REPLIED",
      ).length,
      replied: dashboard.opportunities.filter(
        (opportunity) => opportunity.status === "REPLIED",
      ).length,
    }),
    [dashboard.opportunities],
  );
  const visibleOpportunities = dashboard.opportunities.filter((opportunity) => {
    if (opportunity.status === "DISMISSED") {
      return false;
    }

    if (replyStateFilter === "replied") {
      if (opportunity.status !== "REPLIED") {
        return false;
      }
    } else if (opportunity.status === "REPLIED") {
      return false;
    }

    if (opportunityFilter === "high") {
      return opportunity.intentScore >= 70;
    }

    return opportunity.intentScore < 70;
  });
  const hasOpportunities = visibleOpportunities.length > 0;

  function openNewProjectComposer() {
    setError(null);
    setNotice(null);
    setForm(buildEmptyProjectForm());
    setComposerMode("create");
  }

  function openEditComposer() {
    setError(null);
    setNotice(null);
    setForm(buildFormState(dashboard));
    setComposerMode("edit");
  }

  function closeComposer() {
    setComposerMode(null);
    setError(null);
  }

  function openPostDraftPanel(postDraft: PostDraftPanelState) {
    setActivePostDraft(postDraft);
  }

  function closePostDraftPanel() {
    setActivePostDraft(null);
  }

  async function copyDraftToClipboard(
    draftKey: string,
    text: string,
    label: string,
  ) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDraftKey(draftKey);
      setNotice(`${label} copied to clipboard.`);
      setError(null);
    } catch {
      setError(`Could not copy the ${label.toLowerCase()}.`);
    }
  }

  async function handleAutofill() {
    if (!form.websiteUrl.trim()) {
      setError("Enter a product URL to autofill the form.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsAutofilling(true);

    const response = await fetch("/api/autofill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: form.websiteUrl }),
    });

    const payload = (await response.json()) as {
      productName?: string;
      productDescription?: string;
      keywords?: string[];
      resolvedUrl?: string;
      error?: string;
    };

    setIsAutofilling(false);

    if (!response.ok) {
      setError(payload.error || "Could not autofill from that URL.");
      return;
    }

    setForm((current) => ({
      ...current,
      productName: payload.productName || current.productName,
      productDescription:
        payload.productDescription || current.productDescription,
      keywords: payload.keywords?.length
        ? payload.keywords.join(", ")
        : current.keywords,
      websiteUrl: payload.resolvedUrl || current.websiteUrl,
    }));
    setNotice(
      "Form autofilled from the website. Review and edit anything before running discovery.",
    );
  }

  async function handleDiscover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsDiscovering(true);

    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as {
      dashboard?: DashboardState;
      error?: string;
      persisted?: boolean;
    };

    setIsDiscovering(false);

    if (!response.ok || !payload.dashboard) {
      setError(payload.error || "Discovery failed.");
      return;
    }

    setDashboard(payload.dashboard);
    setForm(buildFormState(payload.dashboard));
    setOpportunityFilter(
      getDefaultOpportunityFilter(payload.dashboard.opportunities),
    );
    setComposerMode(null);
    setNotice(
      payload.persisted
        ? "Discovery run saved to your workspace."
        : "Preview generated. Add Neon + Clerk to persist it.",
    );
    setPostDrafts(buildPostDraftState(payload.dashboard.postDrafts));
    setReplyDrafts(buildReplyDraftState(payload.dashboard.opportunities));
    setReplyScores(buildReplyScoreState(payload.dashboard.opportunities));
    router.refresh();
  }

  async function handleRefreshDiscovery() {
    if (!dashboard.currentProjectId) {
      setError("Select a project before rerunning discovery.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsRefreshingDiscovery(true);

    const response = await fetch("/api/opportunities", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: dashboard.currentProjectId,
      }),
    });

    const payload = (await response.json()) as {
      dashboard?: DashboardState;
      error?: string;
      persisted?: boolean;
    };

    setIsRefreshingDiscovery(false);

    if (!response.ok || !payload.dashboard) {
      setError(payload.error || "Could not refresh discovery.");
      return;
    }

    setDashboard(payload.dashboard);
    setForm(buildFormState(payload.dashboard));
    setOpportunityFilter(
      getDefaultOpportunityFilter(payload.dashboard.opportunities),
    );
    setComposerMode(null);
    setPostDrafts(buildPostDraftState(payload.dashboard.postDrafts));
    setReplyDrafts(buildReplyDraftState(payload.dashboard.opportunities));
    setReplyScores(buildReplyScoreState(payload.dashboard.opportunities));
    setNotice("Discovery rerun completed for the current project.");
    router.refresh();
  }

  async function generateReply(opportunity: OpportunityCard) {
    setBusyOpportunityId(opportunity.id);
    setError(null);

    const response = await fetch("/api/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opportunityId: opportunity.id,
        productName: form.productName,
        productDescription: form.productDescription,
        subreddit: opportunity.subreddit,
        title: opportunity.title,
        excerpt: opportunity.excerpt,
      }),
    });

    const payload = (await response.json()) as {
      reply?: string;
      softPromotionScore?: number;
      error?: string;
    };

    setBusyOpportunityId(null);

    if (!response.ok || !payload.reply) {
      setError(payload.error || "Reply generation failed.");
      return;
    }

    setReplyDrafts((current) => ({
      ...current,
      [opportunity.id]: payload.reply as string,
    }));
    setReplyScores((current) => ({
      ...current,
      [opportunity.id]: payload.softPromotionScore ?? 0,
    }));
    setDashboard((current) => ({
      ...current,
      opportunities: current.opportunities.map((item) =>
        item.id === opportunity.id
          ? {
              ...item,
              replyDraft: payload.reply as string,
              replySoftPromotionScore: payload.softPromotionScore ?? 0,
            }
          : item,
      ),
    }));
  }

  async function updateWorkflow(opportunityId: string, status: WorkflowStatus) {
    setDashboard((current) => ({
      ...current,
      opportunities: current.opportunities.map((opportunity) =>
        opportunity.id === opportunityId
          ? { ...opportunity, status }
          : opportunity,
      ),
    }));
    setNotice(
      status === "SAVED"
        ? "Thread saved."
        : status === "NEW"
          ? "Thread removed from saved."
          : status === "REPLIED"
            ? "Thread marked as replied."
            : status === "DISMISSED"
              ? "Thread dismissed."
              : null,
    );

    if (!dashboard.configured.clerk || !dashboard.configured.database) {
      setNotice((current) =>
        current
          ? `${current} Configure Clerk + Neon to persist statuses.`
          : "Workflow updated locally. Configure Clerk + Neon to persist statuses.",
      );
      return;
    }

    setBusyOpportunityId(opportunityId);

    const response = await fetch(`/api/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    setBusyOpportunityId(null);

    if (!response.ok) {
      setError("Could not persist the workflow update.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleActionReply(opportunityId?: string) {
    if (!opportunityId) {
      return;
    }

    const opportunity = opportunityById.get(opportunityId);

    if (!opportunity) {
      setError("Could not find the thread for that action.");
      return;
    }

    await generateReply(opportunity);
  }

  async function handleActionPostDraft(action: {
    id: string;
    subreddit: string;
    summary: string;
    riskNote: string;
  }) {
    setBusyPostActionId(action.id);
    setError(null);

    const response = await fetch("/api/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: dashboard.currentProjectId,
        actionKey: action.id,
        productName: form.productName,
        productDescription: form.productDescription,
        subreddit: action.subreddit,
        summary: action.summary,
        riskNote: action.riskNote,
      }),
    });

    const payload = (await response.json()) as {
      title?: string;
      body?: string;
      rules?: string[];
      review?: {
        verdict?: "looks-safe" | "review-needed" | "likely-to-be-removed";
        summary?: string;
        issues?: string[];
      };
      error?: string;
    };

    setBusyPostActionId(null);

    if (!response.ok || !payload.title || !payload.body) {
      setError(payload.error || "Post draft generation failed.");
      return;
    }

    setPostDrafts((current) => ({
      ...current,
      [action.id]: {
        title: payload.title as string,
        body: payload.body as string,
        rules: payload.rules || [],
        review: {
          verdict: payload.review?.verdict || "review-needed",
          summary:
            payload.review?.summary ||
            "Review this draft against the subreddit rules before posting.",
          issues: payload.review?.issues || [],
        },
      },
    }));
    openPostDraftPanel({
      actionKey: action.id,
      subreddit: action.subreddit,
      title: payload.title as string,
      body: payload.body as string,
      rules: payload.rules || [],
      review: {
        verdict: payload.review?.verdict || "review-needed",
        summary:
          payload.review?.summary ||
          "Review this draft against the subreddit rules before posting.",
        issues: payload.review?.issues || [],
      },
      updatedAt: new Date().toISOString(),
    });
    setDashboard((current) => ({
      ...current,
      postDrafts: upsertPostDraftList(current.postDrafts, {
        id: action.id,
        actionKey: action.id,
        subreddit: action.subreddit,
        title: payload.title as string,
        body: payload.body as string,
        rules: payload.rules || [],
        review: {
          verdict: payload.review?.verdict || "review-needed",
          summary:
            payload.review?.summary ||
            "Review this draft against the subreddit rules before posting.",
          issues: payload.review?.issues || [],
        },
        updatedAt: new Date().toISOString(),
      }),
    }));
  }

  async function completeTodayAction(action: ActionCard) {
    const previousDashboard = dashboard;
    const nextOpportunityStatus =
      action.type === "COMMENT" && action.opportunityId ? "REPLIED" : null;

    setError(null);
    setNotice(null);
    setCompletingActionId(action.id);
    setDashboard((current) => ({
      ...current,
      actions: current.actions.filter((item) => item.id !== action.id),
      opportunities: nextOpportunityStatus
        ? current.opportunities.map((opportunity) =>
            opportunity.id === action.opportunityId
              ? { ...opportunity, status: nextOpportunityStatus }
              : opportunity,
          )
        : current.opportunities,
    }));

    if (!dashboard.configured.clerk || !dashboard.configured.database) {
      setCompletingActionId(null);
      setNotice(
        nextOpportunityStatus
          ? "Action completed locally and inbox marked replied."
          : "Action completed locally.",
      );
      return;
    }

    const response = await fetch("/api/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: dashboard.currentProjectId,
        actionId: action.id,
        opportunityId: action.opportunityId,
        opportunityStatus: nextOpportunityStatus || undefined,
      }),
    });

    setCompletingActionId(null);

    if (!response.ok) {
      setDashboard(previousDashboard);
      setError("Could not mark that action complete.");
      return;
    }

    setNotice(
      nextOpportunityStatus
        ? "Action completed for today and inbox marked replied."
        : "Action completed for today.",
    );
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleTrackPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trackedPostUrl.trim()) {
      setError("Paste a Reddit post URL to track metrics.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsTrackingPost(true);

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: dashboard.currentProjectId,
        permalink: trackedPostUrl,
      }),
    });

    const payload = (await response.json()) as {
      trackedPost?: TrackedPostCard;
      persisted?: boolean;
      error?: string;
    };

    setIsTrackingPost(false);

    if (!response.ok || !payload.trackedPost) {
      setError(payload.error || "Could not track that Reddit post.");
      return;
    }

    setDashboard((current) => ({
      ...current,
      trackedPosts: upsertTrackedPostList(
        current.trackedPosts,
        payload.trackedPost!,
      ),
    }));
    setTrackedPostUrl("");
    setNotice(
      payload.persisted
        ? "Reddit post added to tracked metrics."
        : "Reddit post added locally. Configure Clerk + Neon to persist it.",
    );
  }

  async function refreshTrackedPost(post: TrackedPostCard) {
    setError(null);
    setNotice(null);
    setBusyTrackedPostId(post.redditId);

    const response = await fetch("/api/posts", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: dashboard.currentProjectId,
        permalink: post.permalink,
      }),
    });

    const payload = (await response.json()) as {
      trackedPost?: TrackedPostCard;
      persisted?: boolean;
      error?: string;
    };

    setBusyTrackedPostId(null);

    if (!response.ok || !payload.trackedPost) {
      setError(payload.error || "Could not refresh that Reddit post.");
      return;
    }

    setDashboard((current) => ({
      ...current,
      trackedPosts: upsertTrackedPostList(
        current.trackedPosts,
        payload.trackedPost!,
      ),
    }));
    setNotice(
      payload.persisted
        ? "Tracked post metrics refreshed."
        : "Tracked post metrics refreshed locally.",
    );
  }

  async function handleDeletePostDraft(postDraft: PostDraftCard) {
    setError(null);
    setNotice(null);
    setDeletingPostDraftId(postDraft.id);

    setPostDrafts((current) => {
      const next = { ...current };
      delete next[postDraft.actionKey];
      return next;
    });
    setDashboard((current) => ({
      ...current,
      postDrafts: current.postDrafts.filter((item) => item.id !== postDraft.id),
    }));

    if (activePostDraft?.actionKey === postDraft.actionKey) {
      setActivePostDraft(null);
    }

    if (!dashboard.configured.clerk || !dashboard.configured.database) {
      setDeletingPostDraftId(null);
      setNotice("Post draft removed locally.");
      return;
    }

    const response = await fetch(`/api/post-drafts/${postDraft.id}`, {
      method: "DELETE",
    });

    setDeletingPostDraftId(null);

    if (!response.ok) {
      setError("Could not delete that post draft.");
      router.refresh();
      return;
    }

    setNotice("Post draft deleted.");
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDeleteTrackedPost(post: TrackedPostCard) {
    setError(null);
    setNotice(null);
    setDeletingTrackedPostId(post.id);

    setDashboard((current) => ({
      ...current,
      trackedPosts: current.trackedPosts.filter((item) => item.id !== post.id),
    }));

    if (!dashboard.configured.clerk || !dashboard.configured.database) {
      setDeletingTrackedPostId(null);
      setNotice("Tracked post removed locally.");
      return;
    }

    const response = await fetch(`/api/posts/${post.id}`, {
      method: "DELETE",
    });

    setDeletingTrackedPostId(null);

    if (!response.ok) {
      setError("Could not delete that tracked post.");
      router.refresh();
      return;
    }

    setNotice("Tracked post deleted.");
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDeleteProject() {
    if (!currentProject) {
      setError("Select a project before deleting it.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${currentProject.name}? This removes its keywords, opportunities, tracked posts, drafts, and completed actions.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsDeletingProject(true);

    if (!dashboard.configured.clerk || !dashboard.configured.database) {
      setDashboard((current) => ({
        ...current,
        projects: current.projects.filter(
          (project) => project.id !== currentProject.id,
        ),
        currentProjectId: null,
        websiteUrl: "",
        productName: "",
        productDescription: "",
        trackedKeywords: [],
        trackedPosts: [],
        postDrafts: [],
        analytics: {
          totalOpportunities: 0,
          hotLeads: 0,
          repliedThreads: 0,
          safeSubreddits: 0,
          averageIntent: 0,
        },
        actions: [],
        subreddits: [],
        opportunities: [],
      }));
      setForm(buildEmptyProjectForm());
      setReplyDrafts({});
      setReplyScores({});
      setPostDrafts({});
      setActivePostDraft(null);
      setActiveWorkspaceTool(null);
      setComposerMode("create");
      setIsDeletingProject(false);
      setNotice("Project removed locally.");
      return;
    }

    const response = await fetch(`/api/projects/${currentProject.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as {
      dashboard?: DashboardState;
      error?: string;
    };

    setIsDeletingProject(false);

    if (!response.ok || !payload.dashboard) {
      setError(payload.error || "Could not delete that project.");
      return;
    }

    setDashboard(payload.dashboard);
    setForm(buildFormState(payload.dashboard));
    setOpportunityFilter(
      getDefaultOpportunityFilter(payload.dashboard.opportunities),
    );
    setReplyStateFilter("not-replied");
    setReplyDrafts(buildReplyDraftState(payload.dashboard.opportunities));
    setReplyScores(buildReplyScoreState(payload.dashboard.opportunities));
    setPostDrafts(buildPostDraftState(payload.dashboard.postDrafts));
    setActivePostDraft(null);
    setActiveWorkspaceTool(null);
    setComposerMode(payload.dashboard.currentProjectId ? null : "create");
    setNotice("Project deleted.");

    const nextPath = payload.dashboard.currentProjectId
      ? `/dashboard?project=${payload.dashboard.currentProjectId}`
      : "/dashboard";

    startTransition(() => {
      router.push(nextPath);
      router.refresh();
    });
  }

  async function handleGenerateCommentReply(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !commentReplyComposer.postUrl.trim() ||
      !commentReplyComposer.commentUrl.trim()
    ) {
      setError("Paste both the Reddit post URL and the comment URL.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsGeneratingCommentReply(true);

    const response = await fetch("/api/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productName: form.productName,
        productDescription: form.productDescription,
        postUrl: commentReplyComposer.postUrl,
        commentUrl: commentReplyComposer.commentUrl,
      }),
    });

    const payload = (await response.json()) as {
      reply?: string;
      softPromotionScore?: number;
      context?: {
        subreddit?: string;
        postTitle?: string;
        commentAuthor?: string;
        commentBody?: string;
      };
      error?: string;
    };

    setIsGeneratingCommentReply(false);

    if (!response.ok || !payload.reply || !payload.context) {
      setError(payload.error || "Could not generate a reply for that comment.");
      return;
    }

    setGeneratedCommentReply({
      reply: payload.reply,
      softPromotionScore: payload.softPromotionScore ?? 0,
      subreddit: payload.context.subreddit || "unknown",
      postTitle: payload.context.postTitle || "Untitled post",
      commentAuthor: payload.context.commentAuthor || "unknown",
      commentBody: payload.context.commentBody || "",
    });
    setNotice("Comment reply draft generated.");
  }

  async function handleGeneratePostComment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!postCommentComposer.postUrl.trim()) {
      setError("Paste a Reddit post URL to draft a comment.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsGeneratingPostComment(true);

    const response = await fetch("/api/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productName: form.productName,
        productDescription: form.productDescription,
        postUrl: postCommentComposer.postUrl,
      }),
    });

    const payload = (await response.json()) as {
      comment?: string;
      softPromotionScore?: number;
      context?: {
        subreddit?: string;
        postTitle?: string;
        postAuthor?: string;
        postBody?: string;
      };
      error?: string;
    };

    setIsGeneratingPostComment(false);

    if (!response.ok || !payload.comment || !payload.context) {
      setError(payload.error || "Could not generate a comment for that post.");
      return;
    }

    setGeneratedPostComment({
      comment: payload.comment,
      softPromotionScore: payload.softPromotionScore ?? 0,
      subreddit: payload.context.subreddit || "unknown",
      postTitle: payload.context.postTitle || "Untitled post",
      postAuthor: payload.context.postAuthor || "unknown",
      postBody: payload.context.postBody || "",
    });
    setNotice("Post comment draft generated.");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 lg:px-10">
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside className="app-panel min-w-0 p-4 lg:sticky lg:top-28">
          <div className="flex items-center justify-between gap-3">
            <h2 className="app-title text-lg">Workspace projects</h2>
            <button
              type="button"
              onClick={openNewProjectComposer}
              className="rounded-md bg-[#d95d39] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30]"
            >
              New
            </button>
          </div>

          <div className="mt-4 max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto pr-1">
            {dashboard.projects.length ? (
              <>
                {dashboard.projects.map((project) => {
                  const isCurrent = project.id === dashboard.currentProjectId;
                  const faviconUrl = buildFaviconUrl(project.websiteUrl);

                  return (
                    <Link
                      key={project.id}
                      href={`/dashboard?project=${project.id}`}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                        isCurrent
                          ? "border-[#155e63]/40 bg-[#edf6f6]"
                          : "border-black/10 bg-white hover:border-black/20"
                      }`}
                    >
                      {faviconUrl ? (
                        <Image
                          src={faviconUrl}
                          alt=""
                          aria-hidden="true"
                          width={24}
                          height={24}
                          className="h-6 w-6 shrink-0 rounded"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-[#14110f]">
                          {project.name}
                        </h3>
                        <p className="mt-1 truncate text-xs text-[#6b6258]">
                          {project.keywordCount} keywords ·{" "}
                          {project.opportunityCount} opps · Updated{" "}
                          {formatUpdatedAt(project.updatedAt)}
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#155e63]" />
                      ) : null}
                    </Link>
                  );
                })}
              </>
            ) : (
              <div className="app-panel-muted w-full p-4 text-sm leading-6 text-[#5b524a]">
                No projects yet. Create a project to keep separate keyword sets,
                opportunities, and reply workflows inside the same workspace.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={openEditComposer}
            disabled={!currentProject}
            className="mt-4 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit selected
          </button>
        </aside>

        <div className="min-w-0 space-y-4">
          <section className="app-panel p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(20rem,1fr)_auto] xl:items-start">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-normal text-[#8b8278]">
                  Current project
                </p>
                <div className="mt-1 flex min-w-0 items-start gap-3">
                  {currentProject?.websiteUrl ? (
                    <Image
                      src={buildFaviconUrl(currentProject.websiteUrl) || ""}
                      alt=""
                      aria-hidden="true"
                      width={28}
                      height={28}
                      className="mt-1 h-7 w-7 shrink-0 rounded"
                    />
                  ) : null}
                  <h2 className="app-title min-w-0 text-2xl leading-tight [overflow-wrap:anywhere]">
                    {currentProject?.name || "No project selected"}
                  </h2>
                </div>
                <p className="app-copy mt-3 max-w-4xl text-sm">
                  {currentProject?.description ||
                    "Create a project to start tracking separate products or client workspaces inside the same account."}
                </p>
              </div>
              <div className="flex max-w-full flex-wrap gap-2 xl:max-w-[48rem] xl:justify-end">
            {currentProject ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTool("drafts")}
                  className="app-button app-button-secondary text-sm"
                >
                  Drafts ({dashboard.postDrafts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTool("reply")}
                  className="app-button app-button-secondary text-sm"
                >
                  Reply helper
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTool("comment")}
                  className="app-button app-button-secondary text-sm"
                >
                  Comment helper
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTool("tracking")}
                  className="app-button app-button-secondary text-sm"
                >
                  Tracked posts ({trackedPostTotals.count})
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={isDeletingProject}
                  className="app-button app-button-secondary border-[#b9381d]/30 text-[#b9381d] hover:border-[#b9381d]/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingProject ? "Deleting..." : "Delete project"}
                </button>
              </>
            ) : null}
            {currentProject?.websiteUrl ? (
              <>
                {isLocalDevelopment ? (
                  <button
                    type="button"
                    onClick={handleRefreshDiscovery}
                    disabled={!currentProject || isRefreshingDiscovery}
                    className="app-button app-button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRefreshingDiscovery
                      ? "Refreshing..."
                      : "Re-run discovery"}
                  </button>
                ) : null}
                <a
                  href={currentProject.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="app-button app-button-secondary text-sm"
                >
                  Visit website
                </a>
              </>
            ) : isLocalDevelopment && currentProject ? (
              <>
                <button
                  type="button"
                  onClick={handleRefreshDiscovery}
                  disabled={isRefreshingDiscovery}
                  className="app-button app-button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefreshingDiscovery ? "Refreshing..." : "Re-run discovery"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {currentProject ? (
          <div className="mt-4 grid gap-2 border-t border-black/10 pt-4 sm:grid-cols-5">
            {metricCards.map((metric) => (
              <div key={metric.key}>
                <p className="text-xs text-[#6b6258]">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold text-[#14110f]">
                  {dashboard.analytics[metric.key]}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-[#b9381d]">{error}</p> : null}
        {notice ? (
          <p className="mt-4 text-sm text-[#155e63]">{notice}</p>
        ) : null}
      </section>

      <section className="app-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#14110f]">
              Today&apos;s 3 actions
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentProject ? (
              <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                {currentProject.name}
              </span>
            ) : null}
            {dashboard.demoMode ? (
              <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                Preview
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 max-w-full overflow-x-auto pb-1">
          {hasActions ? (
            <div className="flex w-max min-w-full gap-2 pr-2">
              {dashboard.actions.map((action) => {
                const submitUrl =
                  action.submitUrl || buildSubredditSubmitPath(action.subreddit);
                const linkedOpportunity = action.opportunityId
                  ? opportunityById.get(action.opportunityId)
                  : null;
                const isSaved = linkedOpportunity
                  ? isSavedStatus(linkedOpportunity.status)
                  : false;
                const actionReplyDraft = linkedOpportunity
                  ? replyDrafts[linkedOpportunity.id]
                  : null;
                const actionReplyScore = linkedOpportunity
                  ? (replyScores[linkedOpportunity.id] ?? 0)
                  : 0;

                return (
                  <div
                    key={action.id}
                    className="flex min-h-[11rem] w-[20rem] shrink-0 flex-col rounded-lg border border-black/10 bg-white p-4 sm:w-[28rem]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-normal text-[#6b6258]">
                          {action.type} · {action.priority}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[#14110f]">
                          {action.title}
                        </h3>
                      </div>
                      <span className="shrink-0 rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                        r/{action.subreddit}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#4f4740]">
                      {action.summary}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      {action.type === "COMMENT" ? (
                        <>
                          {action.permalink ? (
                            <a
                              href={action.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                            >
                              Open thread
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              handleActionReply(action.opportunityId)
                            }
                            disabled={
                              !action.opportunityId ||
                              busyOpportunityId === action.opportunityId
                            }
                            className="rounded-md bg-[#d95d39] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyOpportunityId === action.opportunityId
                              ? "Drafting..."
                              : "Draft reply"}
                          </button>
                          {action.opportunityId ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorkflow(
                                    action.opportunityId!,
                                    isSaved ? "NEW" : "SAVED",
                                  )
                                }
                                className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                              >
                                {isSaved ? "Unsave thread" : "Save thread"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorkflow(
                                    action.opportunityId!,
                                    "REPLIED",
                                  )
                                }
                                className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                              >
                                Mark replied
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleActionPostDraft({
                                id: action.id,
                                subreddit: action.subreddit,
                                summary: action.summary,
                                riskNote: action.riskNote,
                              })
                            }
                            disabled={busyPostActionId === action.id}
                            className="rounded-md bg-[#d95d39] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyPostActionId === action.id
                              ? "Drafting..."
                              : "Draft post"}
                          </button>
                          <a
                            href={submitUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                          >
                            Create post
                          </a>
                          {postDrafts[action.id] ? (
                            <button
                              type="button"
                              onClick={() =>
                                openPostDraftPanel({
                                  actionKey: action.id,
                                  subreddit: action.subreddit,
                                  title: postDrafts[action.id].title,
                                  body: postDrafts[action.id].body,
                                  rules: postDrafts[action.id].rules,
                                  review: postDrafts[action.id].review,
                                })
                              }
                              className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                            >
                              View draft
                            </button>
                          ) : null}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => completeTodayAction(action)}
                        disabled={completingActionId === action.id}
                        className="rounded-md border border-[#155e63]/25 px-3 py-2 text-sm font-semibold text-[#155e63] transition hover:bg-[#edf6f6] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {completingActionId === action.id
                          ? "Completing..."
                          : "Complete"}
                      </button>
                    </div>
                    {action.type === "COMMENT" &&
                    linkedOpportunity &&
                    actionReplyDraft ? (
                      <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-[#155e63]/20 bg-[#edf6f6] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-mono text-xs uppercase tracking-normal text-[#155e63]">
                              Reply draft
                            </p>
                            <p className="mt-1 text-xs text-[#155e63]">
                              Soft-promo score: {actionReplyScore}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyDraftToClipboard(
                                `action-reply:${linkedOpportunity.id}`,
                                actionReplyDraft,
                                "Reply draft",
                              )
                            }
                            className="shrink-0 rounded-md border border-[#155e63]/20 px-2 py-1 text-xs font-semibold text-[#155e63] transition hover:bg-[#155e63]/10"
                          >
                            {copiedDraftKey ===
                            `action-reply:${linkedOpportunity.id}`
                              ? "Copied"
                              : "Copy draft"}
                          </button>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1f3133]">
                          {actionReplyDraft}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="w-full rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-[#5b524a]">
              No strong project-matched actions are available right now. Run
              discovery again after tuning the project keywords.
            </div>
          )}
        </div>
      </section>

      {activeWorkspaceTool === "drafts" ? (
        <div className="panel-overlay-enter fixed inset-0 z-40 flex justify-end bg-black/28 backdrop-blur-[2px]">
          <div className="panel-right-enter h-full w-full max-w-3xl overflow-y-auto border-l border-black/10 bg-[#fffdf8] p-6 shadow-xl sm:p-8">
            <section className="app-panel p-4">
              <button
                type="button"
                aria-label="Close saved drafts"
                onClick={() => setActiveWorkspaceTool(null)}
                className="mb-4 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#14110f]">
              Saved drafts
            </h2>
          </div>
          {currentProject ? (
            <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
              {dashboard.postDrafts.length} saved
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {hasSavedPostDrafts ? (
            dashboard.postDrafts.map((postDraft) => (
              <article
                key={postDraft.id}
                className="rounded-lg border border-black/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-normal text-[#8b8278]">
                      r/{postDraft.subreddit}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[#14110f]">
                      {postDraft.title}
                    </h3>
                  </div>
                  <span className="shrink-0 text-xs text-[#6b6258]">
                    {formatDateTime(postDraft.updatedAt)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#4f4740]">
                  {postDraft.body}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                    {postDraft.review.verdict}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openPostDraftPanel({
                        actionKey: postDraft.actionKey,
                        subreddit: postDraft.subreddit,
                        title: postDraft.title,
                        body: postDraft.body,
                        rules: postDraft.rules,
                        review: postDraft.review,
                        updatedAt: postDraft.updatedAt,
                      })
                    }
                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    View draft
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyDraftToClipboard(
                        `saved-post:${postDraft.actionKey}`,
                        `${postDraft.title}\n\n${postDraft.body}`,
                        "Post draft",
                      )
                    }
                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    {copiedDraftKey === `saved-post:${postDraft.actionKey}`
                      ? "Copied"
                      : "Copy draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePostDraft(postDraft)}
                    disabled={deletingPostDraftId === postDraft.id}
                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingPostDraftId === postDraft.id
                      ? "Deleting..."
                      : "Delete draft"}
                  </button>
                  <a
                    href={buildSubredditSubmitPath(postDraft.subreddit)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    Open submit
                  </a>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-[#5b524a] lg:col-span-2">
              Draft a subreddit-native post and it will stay here for this
              project even if the action card changes later.
            </div>
          )}
        </div>
            </section>
          </div>
          <button
            type="button"
            aria-label="Close saved drafts"
            onClick={() => setActiveWorkspaceTool(null)}
            className="flex-1"
          />
        </div>
      ) : null}

      {activeWorkspaceTool === "comment" ? (
        <div className="panel-overlay-enter fixed inset-0 z-40 flex justify-end bg-black/28 backdrop-blur-[2px]">
          <div className="panel-right-enter h-full w-full max-w-2xl overflow-y-auto border-l border-black/10 bg-[#fffdf8] p-6 shadow-xl sm:p-8">
            <section className="app-panel p-4">
              <button
                type="button"
                aria-label="Close post comment helper"
                onClick={() => setActiveWorkspaceTool(null)}
                className="mb-4 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#14110f]">
                    Post Comment Helper
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[#5b524a]">
                    Draft a top-level comment for a Reddit post using this
                    project&apos;s positioning.
                  </p>
                </div>
                {currentProject ? (
                  <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                    For {currentProject.name}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg border border-black/10 bg-white p-4">
                <form onSubmit={handleGeneratePostComment} className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-[#2f2a26]">
                    Post URL
                    <input
                      value={postCommentComposer.postUrl}
                      onChange={(event) =>
                        setPostCommentComposer({
                          postUrl: event.target.value,
                        })
                      }
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                      placeholder="https://www.reddit.com/r/subreddit/comments/..."
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={isGeneratingPostComment}
                      className="rounded-md bg-[#d95d39] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingPostComment
                        ? "Drafting..."
                        : "Draft comment"}
                    </button>
                    {generatedPostComment ? (
                      <button
                        type="button"
                        onClick={() =>
                          copyDraftToClipboard(
                            "generated-post-comment",
                            generatedPostComment.comment,
                            "Post comment",
                          )
                        }
                        className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                      >
                        {copiedDraftKey === "generated-post-comment"
                          ? "Copied"
                          : "Copy comment"}
                      </button>
                    ) : null}
                  </div>
                </form>

                {generatedPostComment ? (
                  <div className="mt-4 rounded-lg border border-[#155e63]/18 bg-[#edf6f6] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[#155e63]/20 bg-white/70 px-2 py-1 text-xs text-[#155e63]">
                        r/{generatedPostComment.subreddit}
                      </span>
                      <span className="rounded-md border border-[#155e63]/20 bg-white/70 px-2 py-1 text-xs text-[#155e63]">
                        Soft-promo score{" "}
                        {generatedPostComment.softPromotionScore}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[#14110f]">
                      {generatedPostComment.postTitle}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#1f3133]">
                      Post from u/{generatedPostComment.postAuthor}
                    </p>
                    {generatedPostComment.postBody ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4f4740]">
                        {generatedPostComment.postBody}
                      </p>
                    ) : null}
                    <div className="mt-4 rounded-lg border border-white/50 bg-white/70 p-4">
                      <p className="font-mono text-xs uppercase tracking-normal text-[#155e63]">
                        Drafted comment
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1f3133]">
                        {generatedPostComment.comment}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
          <button
            type="button"
            aria-label="Close post comment helper"
            onClick={() => setActiveWorkspaceTool(null)}
            className="flex-1"
          />
        </div>
      ) : null}

      {activeWorkspaceTool === "reply" ? (
        <div className="panel-overlay-enter fixed inset-0 z-40 flex justify-end bg-black/28 backdrop-blur-[2px]">
          <div className="panel-right-enter h-full w-full max-w-2xl overflow-y-auto border-l border-black/10 bg-[#fffdf8] p-6 shadow-xl sm:p-8">
            <section className="app-panel p-4">
              <button
                type="button"
                aria-label="Close comment reply helper"
                onClick={() => setActiveWorkspaceTool(null)}
                className="mb-4 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#14110f]">
              Comment Reply Helper
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#5b524a]">
              Draft from a pasted Reddit comment, or review replies started from
              today&apos;s action cards.
            </p>
          </div>
          {currentProject ? (
            <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
              For {currentProject.name}
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border border-black/10 bg-white p-4">
          <form
            onSubmit={handleGenerateCommentReply}
            className="grid gap-3"
          >
            <label className="grid gap-2 text-sm font-medium text-[#2f2a26]">
              Post URL
              <input
                value={commentReplyComposer.postUrl}
                onChange={(event) =>
                  setCommentReplyComposer((current) => ({
                    ...current,
                    postUrl: event.target.value,
                  }))
                }
                className="rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                placeholder="https://www.reddit.com/r/subreddit/comments/..."
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[#2f2a26]">
              Comment URL
              <input
                value={commentReplyComposer.commentUrl}
                onChange={(event) =>
                  setCommentReplyComposer((current) => ({
                    ...current,
                    commentUrl: event.target.value,
                  }))
                }
                className="rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                placeholder="https://www.reddit.com/r/subreddit/comments/.../comment_id/"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isGeneratingCommentReply}
                className="rounded-md bg-[#d95d39] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingCommentReply
                  ? "Drafting..."
                  : "Draft reply to comment"}
              </button>
              {generatedCommentReply ? (
                <button
                  type="button"
                  onClick={() =>
                    copyDraftToClipboard(
                      "generated-comment-reply",
                      generatedCommentReply.reply,
                      "Comment reply",
                    )
                  }
                  className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                >
                  {copiedDraftKey === "generated-comment-reply"
                    ? "Copied"
                    : "Copy reply"}
                </button>
              ) : null}
            </div>
          </form>

          {generatedCommentReply ? (
            <div className="mt-4 rounded-lg border border-[#155e63]/18 bg-[#edf6f6] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[#155e63]/20 bg-white/70 px-2 py-1 text-xs text-[#155e63]">
                  r/{generatedCommentReply.subreddit}
                </span>
                <span className="rounded-md border border-[#155e63]/20 bg-white/70 px-2 py-1 text-xs text-[#155e63]">
                  Soft-promo score {generatedCommentReply.softPromotionScore}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-[#14110f]">
                {generatedCommentReply.postTitle}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#1f3133]">
                Comment from u/{generatedCommentReply.commentAuthor}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4f4740]">
                {generatedCommentReply.commentBody}
              </p>
              <div className="mt-4 rounded-lg border border-white/50 bg-white/70 p-4">
                <p className="font-mono text-xs uppercase tracking-normal text-[#155e63]">
                  Drafted reply
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1f3133]">
                  {generatedCommentReply.reply}
                </p>
              </div>
            </div>
          ) : null}
        </div>
            </section>
          </div>
          <button
            type="button"
            aria-label="Close comment reply helper"
            onClick={() => setActiveWorkspaceTool(null)}
            className="flex-1"
          />
        </div>
      ) : null}

      {activePostDraft ? (
        <div className="panel-overlay-enter fixed inset-0 z-40 flex justify-start bg-black/28 backdrop-blur-[2px]">
          <div className="panel-left-enter h-full w-full max-w-xl overflow-y-auto border-r border-black/10 bg-[#fffdf8] p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-normal text-[#8b8278]">
                  Post draft
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#14110f]">
                  r/{activePostDraft.subreddit}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePostDraftPanel}
                className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#5b524a]">
                {activePostDraft.review.verdict}
              </span>
              {activePostDraft.updatedAt ? (
                <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#5b524a]">
                  Updated {formatDateTime(activePostDraft.updatedAt)}
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-4 rounded-lg border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-normal text-[#8b8278]">
                  Draft content
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyDraftToClipboard(
                        `post:${activePostDraft.actionKey}`,
                        `${activePostDraft.title}\n\n${activePostDraft.body}`,
                        "Post draft",
                      )
                    }
                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    {copiedDraftKey === `post:${activePostDraft.actionKey}`
                      ? "Copied"
                      : "Copy draft"}
                  </button>
                  <a
                    href={buildSubredditSubmitPath(activePostDraft.subreddit)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    Open submit
                  </a>
                </div>
              </div>
              <p className="text-lg font-semibold text-[#14110f]">
                {activePostDraft.title}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-[#4f4740]">
                {activePostDraft.body}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-normal text-[#8b8278]">
                  Rules review
                </p>
                <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#5b524a]">
                  {activePostDraft.review.verdict}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#4f4740]">
                {activePostDraft.review.summary}
              </p>
              {activePostDraft.review.issues.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4f4740]">
                  {activePostDraft.review.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              {activePostDraft.rules.length ? (
                <div className="mt-4">
                  <p className="font-mono text-xs uppercase tracking-normal text-[#8b8278]">
                    Fetched subreddit rules
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4f4740]">
                    {activePostDraft.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[#5b524a]">
                  Could not fetch subreddit rules automatically. Verify the
                  rules manually before posting.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close post draft panel"
            onClick={closePostDraftPanel}
            className="flex-1"
          />
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)]">
        <div className="app-panel min-w-0 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#14110f]">
                Subreddit radar
              </h2>
            </div>
          </div>

          <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {hasSubreddits ? (
              dashboard.subreddits.map((subreddit) => (
                <div
                  key={subreddit.name}
                  className="min-w-0 rounded-lg border border-black/10 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-[#14110f]">
                        r/{subreddit.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#6b6258]">
                        {subreddit.promoTag}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-[#5b524a]">
                      <div>{subreddit.mentions} threads</div>
                      <div>{subreddit.engagementScore} engagement</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-black/6">
                    <div
                      className="h-1.5 rounded-full bg-[#155e63]"
                      style={{
                        width: `${Math.max(8, subreddit.averageIntent)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#5b524a]">
                    Average intent score: {subreddit.averageIntent}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-[#5b524a]">
                Subreddit matches will appear here after you run a keyword
                discovery search.
              </div>
            )}
          </div>
        </div>

        <div className="app-panel min-w-0 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#14110f]">
                Opportunity inbox
              </h2>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#5b524a]">Filter:</span>
            <button
              type="button"
              onClick={() => setOpportunityFilter("high")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                opportunityFilter === "high"
                  ? "bg-[#14110f] text-white"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              High ({opportunityCounts.high})
            </button>
            <button
              type="button"
              onClick={() => setOpportunityFilter("low")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                opportunityFilter === "low"
                  ? "bg-[#14110f] text-white"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              Low ({opportunityCounts.low})
            </button>
            <span className="ml-2 text-sm font-medium text-[#5b524a]">
              Reply:
            </span>
            <button
              type="button"
              onClick={() => setReplyStateFilter("not-replied")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                replyStateFilter === "not-replied"
                  ? "bg-[#14110f] text-white"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              Not replied ({opportunityCounts.notReplied})
            </button>
            <button
              type="button"
              onClick={() => setReplyStateFilter("replied")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                replyStateFilter === "replied"
                  ? "bg-[#14110f] text-white"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              Replied ({opportunityCounts.replied})
            </button>
          </div>

          <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {hasOpportunities ? (
              visibleOpportunities.map((opportunity) =>
                (() => {
                  const isSaved = isSavedStatus(opportunity.status);

                  return (
                    <article
                      key={opportunity.id}
                      className="min-w-0 overflow-hidden rounded-lg border border-black/10 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="max-w-full break-words rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6f675f]">
                            {opportunity.keyword}
                          </span>
                          <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-[#5b524a]">
                            r/{opportunity.subreddit}
                          </span>
                          <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-[#5b524a]">
                            {opportunity.status}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 text-xs text-[#5b524a]">
                          <span>Intent {opportunity.intentScore}</span>
                          <span>Risk {opportunity.riskScore}</span>
                          <span>{opportunity.commentsCount} comments</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 break-words text-base font-semibold text-[#14110f]">
                          <a
                            href={opportunity.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="block break-words hover:text-[#155e63]"
                          >
                            {opportunity.title}
                          </a>
                        </h3>
                        <a
                          href={opportunity.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-[#155e63] transition hover:border-[#155e63]/30 hover:bg-[#155e63]/5"
                        >
                          Open on Reddit
                        </a>
                      </div>
                      <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-[#4f4740]">
                        {opportunity.excerpt ||
                          "No post body was returned for this thread."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => generateReply(opportunity)}
                          disabled={busyOpportunityId === opportunity.id}
                          className="rounded-md bg-[#d95d39] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyOpportunityId === opportunity.id
                            ? "Drafting..."
                            : "Draft reply"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkflow(
                              opportunity.id,
                              isSaved ? "NEW" : "SAVED",
                            )
                          }
                          className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                        >
                          {isSaved ? "Unsave" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkflow(opportunity.id, "REPLIED")
                          }
                          className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                        >
                          Mark replied
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkflow(opportunity.id, "DISMISSED")
                          }
                          className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                        >
                          Dismiss
                        </button>
                      </div>

                      {replyDrafts[opportunity.id] ? (
                        <div className="mt-4 rounded-lg border border-[#155e63]/20 bg-[#edf6f6] p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-mono text-xs uppercase tracking-normal text-[#155e63]">
                                Reply draft
                              </p>
                              <p className="mt-1 text-xs text-[#155e63]">
                                Soft-promo score:{" "}
                                {replyScores[opportunity.id] ?? 0}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                copyDraftToClipboard(
                                  `reply:${opportunity.id}`,
                                  replyDrafts[opportunity.id],
                                  "Reply draft",
                                )
                              }
                              className="rounded-md border border-[#155e63]/20 px-2 py-1 text-xs font-semibold text-[#155e63] transition hover:bg-[#155e63]/10"
                            >
                              {copiedDraftKey === `reply:${opportunity.id}`
                                ? "Copied"
                                : "Copy draft"}
                            </button>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1f3133]">
                            {replyDrafts[opportunity.id]}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })(),
              )
            ) : (
              <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-[#5b524a]">
                No {opportunityFilter}-intent {replyStateFilter} opportunities
                match this project right now. Adjust the project keywords or run
                discovery again to refresh the inbox.
              </div>
            )}
          </div>
        </div>
      </section>

      {activeWorkspaceTool === "tracking" ? (
        <div className="panel-overlay-enter fixed inset-0 z-40 flex justify-end bg-black/28 backdrop-blur-[2px]">
          <div className="panel-right-enter h-full w-full max-w-4xl overflow-y-auto border-l border-black/10 bg-[#fffdf8] p-6 shadow-xl sm:p-8">
            <section className="app-panel p-4">
              <button
                type="button"
                aria-label="Close tracked posts"
                onClick={() => setActiveWorkspaceTool(null)}
                className="mb-4 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#14110f]">
              Tracked Reddit posts
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#6b6258]">
            <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1">
              {trackedPostTotals.count} tracked posts
            </span>
            <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1">
              {trackedPostTotals.totalScore} total score
            </span>
            <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1">
              {trackedPostTotals.totalComments} total comments
            </span>
          </div>
        </div>

        <form
          onSubmit={handleTrackPost}
          className="mt-4 flex flex-col gap-2 lg:flex-row"
        >
          <input
            value={trackedPostUrl}
            onChange={(event) => setTrackedPostUrl(event.target.value)}
            disabled={!currentProject || isTrackingPost}
            className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39] disabled:cursor-not-allowed disabled:bg-black/[0.03]"
            placeholder="https://www.reddit.com/r/subreddit/comments/..."
          />
          <button
            type="submit"
            disabled={!currentProject || isTrackingPost}
            className="rounded-md bg-[#d95d39] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTrackingPost ? "Tracking..." : "Track post"}
          </button>
        </form>

        <p className="mt-3 text-sm leading-6 text-[#5b524a]">
          {currentProject
            ? "Use this for posts you have already published on Reddit. You can refresh any card later to pull the latest numbers."
            : "Select or create a project before tracking post metrics."}
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {hasTrackedPosts ? (
            dashboard.trackedPosts.map((post) => (
              <article
                key={post.redditId}
                className="rounded-lg border border-black/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-normal text-[#8b8278]">
                      r/{post.subreddit}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[#14110f]">
                      {post.title}
                    </h3>
                  </div>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-md border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-[#155e63] transition hover:border-[#155e63]/30 hover:bg-[#155e63]/5"
                  >
                    Open on Reddit
                  </a>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#5b524a]">
                  Posted {formatDateTime(post.postedAt)} by u/{post.author}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-black/10 bg-[#f3f0e8] p-3">
                    <p className="text-xs text-[#8b8278]">
                      Score
                    </p>
                    <p className="mt-1 text-xl font-semibold text-[#14110f]">
                      {post.score}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-[#f3f0e8] p-3">
                    <p className="text-xs text-[#8b8278]">
                      Comments
                    </p>
                    <p className="mt-1 text-xl font-semibold text-[#14110f]">
                      {post.commentsCount}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5b524a]">
                  <span>Last sync {formatDateTime(post.lastSyncedAt)}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => refreshTrackedPost(post)}
                      disabled={
                        busyTrackedPostId === post.redditId ||
                        deletingTrackedPostId === post.id
                      }
                      className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyTrackedPostId === post.redditId
                        ? "Refreshing..."
                        : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTrackedPost(post)}
                      disabled={deletingTrackedPostId === post.id}
                      className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingTrackedPostId === post.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-[#5b524a] lg:col-span-2 xl:col-span-3">
              No tracked posts yet. Paste a Reddit post URL above to start
              tracking score and comment growth for content you have already
              published.
            </div>
          )}
        </div>
            </section>
          </div>
          <button
            type="button"
            aria-label="Close tracked posts"
            onClick={() => setActiveWorkspaceTool(null)}
            className="flex-1"
          />
        </div>
      ) : null}

        </div>
      </div>

      {composerMode ? (
        <div
          className="panel-overlay-enter fixed inset-0 z-40 flex justify-end bg-black/28 backdrop-blur-[2px]"
          onClick={closeComposer}
        >
          <div
            className="panel-right-enter h-full w-full max-w-xl overflow-y-auto border-l border-black/10 bg-[#fffdf8] p-6 shadow-xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-normal text-[#8b8278]">
                  {composerMode === "create" ? "New project" : "Edit project"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[#14110f]">
                  {composerMode === "create"
                    ? "Add a new Reddit project"
                    : `Update ${currentProject?.name || "project"}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleDiscover} className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[#2f2a26]">
                  Website URL
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={form.websiteUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        websiteUrl: event.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                    placeholder="https://yourproduct.com"
                  />
                  <button
                    type="button"
                    onClick={handleAutofill}
                    disabled={isAutofilling}
                    className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAutofilling ? "Autofilling..." : "Autofill"}
                  </button>
                </div>
                <p className="text-sm leading-6 text-[#5b524a]">
                  Pull the product name, description, and keyword ideas from a
                  public website, then edit anything before you save.
                </p>
              </div>

              <label className="grid gap-2 text-sm font-medium text-[#2f2a26]">
                Project name
                <input
                  value={form.productName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productName: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                  placeholder="Acme Reddit Growth"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2f2a26]">
                Project description
                <textarea
                  value={form.productDescription}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productDescription: event.target.value,
                    }))
                  }
                  className="min-h-32 rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                  placeholder="Describe who the product is for, what problem it solves, and how you want to position it on Reddit."
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2f2a26]">
                Keywords
                <textarea
                  value={form.keywords}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      keywords: event.target.value,
                    }))
                  }
                  className="min-h-24 rounded-lg border border-black/10 bg-white px-3 py-2 outline-none transition focus:border-[#d95d39]"
                  placeholder="reddit marketing tool, reddit lead generation, customer pain points"
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isDiscovering}
                  className="rounded-md bg-[#d95d39] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#bf4f30] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDiscovering
                    ? "Scanning Reddit..."
                    : composerMode === "create"
                      ? "Create project and run discovery"
                      : "Save and run discovery"}
                </button>
                <button
                  type="button"
                  onClick={closeComposer}
                  className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

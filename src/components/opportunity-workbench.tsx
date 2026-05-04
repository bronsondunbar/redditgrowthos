"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import type {
  DashboardState,
  OpportunityCard,
  PostDraftCard,
  ProjectSummary,
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

function buildSubredditPath(subreddit: string) {
  return `https://www.reddit.com/r/${subreddit}/`;
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

export function OpportunityWorkbench({ initialState }: WorkbenchProps) {
  const router = useRouter();
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
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [trackedPostUrl, setTrackedPostUrl] = useState("");
  const [isTrackingPost, setIsTrackingPost] = useState(false);
  const [busyTrackedPostId, setBusyTrackedPostId] = useState<string | null>(
    null,
  );
  const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>(
    getDefaultOpportunityFilter(initialState.opportunities),
  );
  const [replyStateFilter, setReplyStateFilter] =
    useState<ReplyStateFilter>("not-replied");
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <section className="grid gap-6">
        <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
                Workspace projects
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#5b524a]">
                Keep multiple products inside one workspace, switch between
                them, and open the composer only when you want to create or
                update a project.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openNewProjectComposer}
                className="rounded-full bg-[#d95d39] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c34f2d]"
              >
                New project
              </button>
              <button
                type="button"
                onClick={openEditComposer}
                disabled={!currentProject}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit selected
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {dashboard.projects.length ? (
              dashboard.projects.map((project) => {
                const isCurrent = project.id === dashboard.currentProjectId;

                return (
                  <Link
                    key={project.id}
                    href={`/dashboard?project=${project.id}`}
                    className={`min-h-[13rem] w-[18rem] shrink-0 rounded-[24px] border p-5 shadow-[0_16px_40px_rgba(20,17,15,0.06)] transition ${
                      isCurrent
                        ? "border-[#155e63]/35 bg-[#155e63]/8"
                        : "border-black/10 bg-[#fffaf0] hover:border-black/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8b8278]">
                          Project
                        </p>
                        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#14110f]">
                          {project.name}
                        </h3>
                      </div>
                      {isCurrent ? (
                        <span className="rounded-full bg-[#14110f] px-3 py-1 text-xs font-semibold text-white">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#5b524a]">
                      {project.description || "No project description yet."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#5b524a]">
                      <span>{project.keywordCount} keywords</span>
                      <span>{project.opportunityCount} opportunities</span>
                      <span>Updated {formatUpdatedAt(project.updatedAt)}</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="w-full rounded-[24px] border border-black/10 bg-[#fffaf0] p-6 text-sm leading-6 text-[#5b524a]">
                No projects yet. Create a project to keep separate keyword sets,
                opportunities, and reply workflows inside the same workspace.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
              Current project
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
              {currentProject?.name || "No project selected"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b524a]">
              {currentProject?.description ||
                "Create a project to start tracking separate products or client workspaces inside the same account."}
            </p>
          </div>
          {currentProject?.websiteUrl ? (
            <a
              href={currentProject.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#14110f] transition hover:bg-black/5"
            >
              Visit website
            </a>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-[#b9381d]">{error}</p> : null}
        {notice ? (
          <p className="mt-4 text-sm text-[#155e63]">{notice}</p>
        ) : null}
      </section>

      {currentProject ? (
        <section className="grid gap-4 md:grid-cols-5">
          {metricCards.map((metric) => (
            <div
              key={metric.key}
              className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-[0_16px_40px_rgba(20,17,15,0.06)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                {metric.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#14110f]">
                {dashboard.analytics[metric.key]}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-[28px] border border-black/10 bg-[#1d4d58] p-6 text-[#f2f7f7] shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Today&apos;s 3 actions
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#d2e6e7]">
              One post and two comments generated from the strongest live
              opportunities currently on the board.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentProject ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.24em]">
                {currentProject.name}
              </span>
            ) : null}
            {dashboard.demoMode ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.24em]">
                Preview
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {hasActions ? (
            dashboard.actions.map((action) => {
              const subredditUrl =
                action.subredditUrl || buildSubredditPath(action.subreddit);
              const submitUrl =
                action.submitUrl || buildSubredditSubmitPath(action.subreddit);
              const linkedOpportunity = action.opportunityId
                ? opportunityById.get(action.opportunityId)
                : null;
              const isSaved = linkedOpportunity
                ? isSavedStatus(linkedOpportunity.status)
                : false;

              return (
                <div
                  key={action.id}
                  className="flex min-h-[15rem] w-[22rem] shrink-0 flex-col rounded-3xl border border-white/12 bg-white/8 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#b6d8d9]">
                        {action.type} · {action.priority}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">
                        {action.title}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/12 px-3 py-1 text-xs leading-5">
                      r/{action.subreddit}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#d9ecec]">
                    {action.summary}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#b6d8d9]">
                    {action.riskNote}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {action.type === "COMMENT" ? (
                      <>
                        {action.permalink ? (
                          <a
                            href={action.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-white px-4 py-2 text-sm font-semibold !text-[#123b40] shadow-[0_1px_0_rgba(20,17,15,0.06)] transition hover:bg-[#eef8f8]"
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
                          className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyOpportunityId === action.opportunityId
                            ? "Drafting..."
                            : "Draft reply"}
                        </button>
                        {action.opportunityId ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateWorkflow(
                                action.opportunityId!,
                                isSaved ? "NEW" : "SAVED",
                              )
                            }
                            className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            {isSaved ? "Unsave thread" : "Save thread"}
                          </button>
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
                          className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyPostActionId === action.id
                            ? "Drafting..."
                            : "Draft post"}
                        </button>
                        <a
                          href={submitUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-white px-4 py-2 text-sm font-semibold !text-[#123b40] shadow-[0_1px_0_rgba(20,17,15,0.06)] transition hover:bg-[#eef8f8]"
                        >
                          Create post
                        </a>
                        <a
                          href={subredditUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Review subreddit
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
                            className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            View draft
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="w-full rounded-3xl border border-white/12 bg-white/8 p-5 text-sm leading-6 text-[#d9ecec]">
              Run your first discovery search to generate a post target and two
              reply opportunities for today.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
              Saved drafts
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5b524a]">
              Generated post drafts stay here per project even when the current
              top posting subreddit changes after a refresh.
            </p>
          </div>
          {currentProject ? (
            <span className="rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-sm text-[#5b524a]">
              {dashboard.postDrafts.length} saved
            </span>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {hasSavedPostDrafts ? (
            dashboard.postDrafts.map((postDraft) => (
              <article
                key={postDraft.id}
                className="rounded-[24px] border border-black/8 bg-[#fffaf0] p-5 shadow-[0_16px_40px_rgba(20,17,15,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                      r/{postDraft.subreddit}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[#14110f]">
                      {postDraft.title}
                    </h3>
                  </div>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[#5b524a]">
                    {formatDateTime(postDraft.updatedAt)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-[#4f4740]">
                  {postDraft.body}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[#5b524a]">
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
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
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
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    {copiedDraftKey === `saved-post:${postDraft.actionKey}`
                      ? "Copied"
                      : "Copy draft"}
                  </button>
                  <a
                    href={buildSubredditSubmitPath(postDraft.subreddit)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    Open submit
                  </a>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-black/8 bg-[#fffaf0] p-6 text-sm leading-6 text-[#5b524a] lg:col-span-2">
              Draft a subreddit-native post and it will stay here for this
              project even if the action card changes later.
            </div>
          )}
        </div>
      </section>

      {activePostDraft ? (
        <div className="fixed inset-0 z-40 flex justify-start bg-black/28 backdrop-blur-[2px]">
          <div className="h-full w-full max-w-xl overflow-y-auto border-r border-black/10 bg-[#fffaf0] p-6 shadow-[20px_0_60px_rgba(20,17,15,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                  Post draft
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
                  r/{activePostDraft.subreddit}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5b524a]">
                  Review, copy, and refine the draft before posting it to the
                  subreddit.
                </p>
              </div>
              <button
                type="button"
                onClick={closePostDraftPanel}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[#5b524a]">
                {activePostDraft.review.verdict}
              </span>
              {activePostDraft.updatedAt ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[#5b524a]">
                  Updated {formatDateTime(activePostDraft.updatedAt)}
                </span>
              ) : null}
            </div>

            <div className="mt-6 space-y-4 rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_16px_40px_rgba(20,17,15,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
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
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
                  >
                    {copiedDraftKey === `post:${activePostDraft.actionKey}`
                      ? "Copied"
                      : "Copy draft"}
                  </button>
                  <a
                    href={buildSubredditSubmitPath(activePostDraft.subreddit)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#14110f] transition hover:bg-black/5"
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

            <div className="mt-6 rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_16px_40px_rgba(20,17,15,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                  Rules review
                </p>
                <span className="rounded-full border border-black/10 bg-[#fffaf0] px-3 py-1 text-xs text-[#5b524a]">
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
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
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

      <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
                Subreddit radar
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5b524a]">
                Ranked by observed intent, thread engagement, and a heuristic
                promo-safety tag.
              </p>
            </div>
          </div>

          <div className="mt-6 max-h-[36rem] space-y-3 overflow-y-auto pr-2">
            {hasSubreddits ? (
              dashboard.subreddits.map((subreddit) => (
                <div
                  key={subreddit.name}
                  className="rounded-3xl border border-black/8 bg-[#fffaf0] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#14110f]">
                        r/{subreddit.name}
                      </h3>
                      <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-[#8b8278]">
                        {subreddit.promoTag}
                      </p>
                    </div>
                    <div className="text-right text-sm text-[#5b524a]">
                      <div>{subreddit.mentions} threads</div>
                      <div>{subreddit.engagementScore} engagement</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-black/6">
                    <div
                      className="h-2 rounded-full bg-[#155e63]"
                      style={{
                        width: `${Math.max(8, subreddit.averageIntent)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#5b524a]">
                    Average intent score: {subreddit.averageIntent}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-black/8 bg-[#fffaf0] p-5 text-sm leading-6 text-[#5b524a]">
                Subreddit matches will appear here after you run a keyword
                discovery search.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
                Opportunity inbox
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5b524a]">
                Spot hot threads, draft the reply, then move them through saved
                and replied states.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#5b524a]">Filter:</span>
            <button
              type="button"
              onClick={() => setOpportunityFilter("high")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                opportunityFilter === "high"
                  ? "bg-[#14110f] text-[#fffaf0]"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              High
            </button>
            <button
              type="button"
              onClick={() => setOpportunityFilter("low")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                opportunityFilter === "low"
                  ? "bg-[#14110f] text-[#fffaf0]"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              Low
            </button>
            <span className="ml-2 text-sm font-medium text-[#5b524a]">
              Reply:
            </span>
            <button
              type="button"
              onClick={() => setReplyStateFilter("not-replied")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                replyStateFilter === "not-replied"
                  ? "bg-[#14110f] text-[#fffaf0]"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              Not replied
            </button>
            <button
              type="button"
              onClick={() => setReplyStateFilter("replied")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                replyStateFilter === "replied"
                  ? "bg-[#14110f] text-[#fffaf0]"
                  : "border border-black/10 text-[#14110f] hover:bg-black/5"
              }`}
            >
              Replied
            </button>
          </div>

          <div className="mt-6 max-h-[36rem] space-y-4 overflow-y-auto pr-2">
            {hasOpportunities ? (
              visibleOpportunities.map((opportunity) =>
                (() => {
                  const isSaved = isSavedStatus(opportunity.status);

                  return (
                    <article
                      key={opportunity.id}
                      className="rounded-3xl border border-black/8 bg-[#fffaf0] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-black/10 bg-white px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-[#6f675f]">
                            {opportunity.keyword}
                          </span>
                          <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-[#5b524a]">
                            r/{opportunity.subreddit}
                          </span>
                          <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-[#5b524a]">
                            {opportunity.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[#5b524a]">
                          <span>Intent {opportunity.intentScore}</span>
                          <span>Risk {opportunity.riskScore}</span>
                          <span>{opportunity.commentsCount} comments</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#14110f]">
                          <a
                            href={opportunity.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-[#155e63]"
                          >
                            {opportunity.title}
                          </a>
                        </h3>
                        <a
                          href={opportunity.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#155e63] transition hover:border-[#155e63]/30 hover:bg-[#155e63]/5"
                        >
                          Open on Reddit
                        </a>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#4f4740]">
                        {opportunity.excerpt ||
                          "No post body was returned for this thread."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => generateReply(opportunity)}
                          disabled={busyOpportunityId === opportunity.id}
                          className="rounded-full bg-[#14110f] px-4 py-2 text-sm font-semibold text-[#fffaf0] transition hover:bg-[#2c2622] disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                        >
                          {isSaved ? "Unsave" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkflow(opportunity.id, "REPLIED")
                          }
                          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                        >
                          Mark replied
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkflow(opportunity.id, "DISMISSED")
                          }
                          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
                        >
                          Dismiss
                        </button>
                      </div>

                      {replyDrafts[opportunity.id] ? (
                        <div className="mt-4 rounded-3xl border border-[#155e63]/20 bg-[#155e63]/6 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#155e63]">
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
                              className="rounded-full border border-[#155e63]/20 px-3 py-1.5 text-xs font-semibold text-[#155e63] transition hover:bg-[#155e63]/10"
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
              <div className="rounded-3xl border border-black/8 bg-[#fffaf0] p-6 text-sm leading-6 text-[#5b524a]">
                No {opportunityFilter}-intent {replyStateFilter} opportunities
                right now. Adjust the filters or run discovery again to refresh
                the inbox.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
              Tracked Reddit posts
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b524a]">
              Paste a Reddit post URL you published to track live score and
              comment metrics inside this project.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-[#5b524a]">
            <span className="rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2">
              {trackedPostTotals.count} tracked posts
            </span>
            <span className="rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2">
              {trackedPostTotals.totalScore} total score
            </span>
            <span className="rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2">
              {trackedPostTotals.totalComments} total comments
            </span>
          </div>
        </div>

        <form
          onSubmit={handleTrackPost}
          className="mt-6 flex flex-col gap-3 lg:flex-row"
        >
          <input
            value={trackedPostUrl}
            onChange={(event) => setTrackedPostUrl(event.target.value)}
            disabled={!currentProject || isTrackingPost}
            className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-[#d95d39] disabled:cursor-not-allowed disabled:bg-black/[0.03]"
            placeholder="https://www.reddit.com/r/subreddit/comments/..."
          />
          <button
            type="submit"
            disabled={!currentProject || isTrackingPost}
            className="rounded-full bg-[#14110f] px-5 py-3 text-sm font-semibold text-[#fffaf0] transition hover:bg-[#2c2622] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTrackingPost ? "Tracking..." : "Track post"}
          </button>
        </form>

        <p className="mt-3 text-sm leading-6 text-[#5b524a]">
          {currentProject
            ? "Use this for posts you have already published on Reddit. You can refresh any card later to pull the latest numbers."
            : "Select or create a project before tracking post metrics."}
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {hasTrackedPosts ? (
            dashboard.trackedPosts.map((post) => (
              <article
                key={post.redditId}
                className="rounded-[24px] border border-black/8 bg-[#fffaf0] p-5 shadow-[0_16px_40px_rgba(20,17,15,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                      r/{post.subreddit}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#14110f]">
                      {post.title}
                    </h3>
                  </div>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#155e63] transition hover:border-[#155e63]/30 hover:bg-[#155e63]/5"
                  >
                    Open on Reddit
                  </a>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#5b524a]">
                  Posted {formatDateTime(post.postedAt)} by u/{post.author}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8b8278]">
                      Score
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#14110f]">
                      {post.score}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8b8278]">
                      Comments
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#14110f]">
                      {post.commentsCount}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5b524a]">
                  <span>Last sync {formatDateTime(post.lastSyncedAt)}</span>
                  <button
                    type="button"
                    onClick={() => refreshTrackedPost(post)}
                    disabled={busyTrackedPostId === post.redditId}
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyTrackedPostId === post.redditId
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[24px] border border-black/10 bg-[#fffaf0] p-6 text-sm leading-6 text-[#5b524a] lg:col-span-2 xl:col-span-3">
              No tracked posts yet. Paste a Reddit post URL above to start
              tracking score and comment growth for content you have already
              published.
            </div>
          )}
        </div>
      </section>

      {composerMode ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/28 backdrop-blur-[2px]">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-black/10 bg-[#fffaf0] p-6 shadow-[-20px_0_60px_rgba(20,17,15,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                  {composerMode === "create" ? "New project" : "Edit project"}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#14110f]">
                  {composerMode === "create"
                    ? "Add a new Reddit project"
                    : `Update ${currentProject?.name || "project"}`}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#5b524a]">
                  The panel slides in so the workspace stays visible while you
                  change website, positioning, and tracked keywords.
                </p>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleDiscover} className="mt-8 grid gap-4">
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
                    className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-[#d95d39]"
                    placeholder="https://yourproduct.com"
                  />
                  <button
                    type="button"
                    onClick={handleAutofill}
                    disabled={isAutofilling}
                    className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-[#14110f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-[#d95d39]"
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
                  className="min-h-32 rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-[#d95d39]"
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
                  className="min-h-24 rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-[#d95d39]"
                  placeholder="reddit marketing tool, reddit lead generation, customer pain points"
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isDiscovering}
                  className="rounded-full bg-[#d95d39] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c34f2d] disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-[#14110f] transition hover:bg-black/5"
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

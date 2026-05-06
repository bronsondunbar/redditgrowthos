import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquareText,
  Radar,
  Route,
  ShieldCheck,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { isClerkConfigured } from "@/lib/config";

const proofPoints = [
  "Intent-ranked Reddit threads",
  "Daily action queue",
  "Help-first reply drafting",
];

const previewProjects = [
  {
    name: "Shipnote",
    meta: "7 keywords · 18 opps · Last discovery today",
    active: true,
  },
  {
    name: "Founder CRM",
    meta: "5 keywords · 9 opps · Last discovery yesterday",
    active: false,
  },
];

const previewMetrics = [
  ["Opportunities", "18"],
  ["Hot leads", "6"],
  ["Replied", "4"],
  ["Avg intent", "72"],
];

const previewActions = [
  {
    type: "COMMENT · HIGH",
    title: "Founder asking how to track customer calls without a CRM",
    subreddit: "SaaS",
    summary: "Thread has a clear workflow pain and a recent buying signal.",
    button: "Draft reply",
  },
  {
    type: "POST · MEDIUM",
    title: "Share a teardown of manual onboarding follow-up",
    subreddit: "startups",
    summary: "Useful educational post with low direct-promotion risk.",
    button: "Draft post",
  },
];

const signals = [
  {
    label: "Buying language",
    value: "86",
    tone: "text-[#d95d39]",
  },
  {
    label: "Subreddit fit",
    value: "72",
    tone: "text-[#155e63]",
  },
  {
    label: "Promotion risk",
    value: "Low",
    tone: "text-[#2f7d59]",
  },
];

const operatingLoop = [
  {
    icon: Radar,
    title: "Discover live demand",
    copy: "Pull real threads into one workspace with context, urgency, and subreddit safety already attached.",
  },
  {
    icon: Route,
    title: "Choose the next move",
    copy: "Turn the noise into a small daily plan: publish one useful post, answer the right comments, and track follow-up.",
  },
  {
    icon: MessageSquareText,
    title: "Draft like a regular",
    copy: "Shape replies around the thread's language so the product mention earns its place instead of feeling bolted on.",
  },
];

const productHighlights = [
  {
    title: "Workspace memory",
    copy: "Keep products, keywords, saved opportunities, post drafts, and tracked posts together instead of spread across tabs.",
  },
  {
    title: "Risk-aware writing",
    copy: "Spot communities where direct selling will backfire and keep your replies useful enough to stay welcome.",
  },
  {
    title: "Repeatable growth rhythm",
    copy: "Make Reddit a daily operating loop for discovery, participation, and follow-up rather than a research rabbit hole.",
  },
];

function DashboardPreview() {
  return (
    <div className="landing-dashboard-preview min-w-0 rounded-xl border border-black/10 bg-[#f6f4ef] p-3 shadow-[0_22px_70px_rgba(20,17,15,0.26)]">
      <div className="grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <aside className="rounded-lg border border-black/10 bg-[#fffdf8] p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#14110f]">
              Workspace projects
            </h2>
            <span className="rounded-md bg-[#d95d39] px-2 py-1 text-xs font-semibold text-white">
              New
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {previewProjects.map((project) => (
              <div
                key={project.name}
                className={`rounded-lg border px-3 py-3 ${
                  project.active
                    ? "border-[#155e63]/40 bg-[#edf6f6]"
                    : "border-black/10 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-[#14110f]">
                    {project.name}
                  </p>
                  {project.active ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#155e63]" />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6b6258]">
                  {project.meta}
                </p>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <section className="rounded-lg border border-black/10 bg-[#fffdf8] p-4">
            <p className="font-mono text-xs uppercase text-[#8b8278]">
              Current project
            </p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight text-[#14110f]">
              Shipnote
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4f4740]">
              Customer support note-taking for founders who need searchable
              call history, follow-up reminders, and lightweight account memory.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-4">
              {previewMetrics.map(([label, value]) => (
                <div key={label}>
                  <p className="text-[0.7rem] leading-4 text-[#6b6258]">
                    {label}
                  </p>
                  <p className="mt-1 text-lg font-semibold leading-none text-[#14110f]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-black/10 bg-[#fffdf8] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#14110f]">
                Today&apos;s 3 actions
              </h2>
              <span className="rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                Preview
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              {previewActions.map((action) => (
                <article
                  key={action.title}
                  className="flex min-h-[9.5rem] flex-col rounded-lg border border-black/10 bg-white p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-[#6b6258]">
                        {action.type}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[#14110f]">
                        {action.title}
                      </h3>
                    </div>
                    <span className="max-w-24 shrink-0 truncate rounded-md border border-black/10 bg-[#f3f0e8] px-2 py-1 text-xs text-[#6b6258]">
                      r/{action.subreddit}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#4f4740]">
                    {action.summary}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <span className="rounded-md bg-[#d95d39] px-3 py-2 text-sm font-semibold text-white">
                      {action.button}
                    </span>
                    <span className="rounded-md border border-[#155e63]/25 px-3 py-2 text-sm font-semibold text-[#155e63]">
                      Complete
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <section className="landing-hero overflow-hidden rounded-xl border border-black/10 p-4 sm:p-6 lg:p-8">
        <div className="grid min-h-[520px] gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div className="max-w-3xl text-white lg:pl-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/18 bg-white/10 px-3 py-2 font-mono text-xs uppercase text-[#f3d8c9] backdrop-blur">
              <BrandMark className="h-6 w-6 shrink-0" />
              Founder-focused Reddit operating system
            </span>

            <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              RedditGrowthOS
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#f4eee6] sm:text-xl">
              Find live buyer intent on Reddit, prioritize the conversations
              worth entering, and turn today&apos;s best threads into a clear
              growth plan.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="app-button app-button-primary min-w-44 gap-2"
                style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
              >
                Open workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={isClerkConfigured ? "/sign-in" : "/dashboard"}
                className="app-button border-white/24 bg-white/92 text-[#14110f] hover:bg-white"
                style={{ color: "#14110f", WebkitTextFillColor: "#14110f" }}
              >
                {isClerkConfigured ? "Sign in" : "Preview without auth"}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/16 bg-black/18 p-4 text-sm leading-6 text-[#fffaf3]"
                >
                  <CheckCircle2 className="mb-3 h-5 w-5 text-[#f47a2f]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <DashboardPreview />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="app-panel p-6 sm:p-8">
          <span className="app-kicker">What changes after setup</span>
          <h2 className="app-title mt-4 max-w-2xl text-3xl sm:text-4xl">
            Your Reddit workflow stops starting from a blank search box.
          </h2>
          <p className="app-copy mt-4 max-w-2xl text-base">
            The workspace keeps discovery, scoring, drafting, and follow-up in
            one place so each day starts with ranked opportunities instead of
            scattered research.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {signals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-lg border border-black/10 bg-[#f7f1e7] p-4"
              >
                <p className="font-mono text-xs uppercase text-[#7b7267]">
                  {signal.label}
                </p>
                <p className={`mt-3 text-3xl font-semibold ${signal.tone}`}>
                  {signal.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {operatingLoop.map((item, index) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="app-panel-muted grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#155e63] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-xs uppercase text-[#8b8278]">
                    Step {index + 1}
                  </p>
                  <h3 className="app-title mt-2 text-2xl">{item.title}</h3>
                  <p className="app-copy mt-2 text-sm">{item.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="app-panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
        <div>
          <span className="app-kicker">Built for careful participation</span>
          <h2 className="app-title mt-4 text-3xl sm:text-4xl">
            Helpful first. Commercial second.
          </h2>
          <p className="app-copy mt-4 text-base">
            Reddit rewards people who understand the room. RedditGrowthOS helps
            you see the room before you write, then keeps the next action small
            enough to actually ship.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {productHighlights.map((highlight) => (
            <article
              key={highlight.title}
              className="rounded-lg border border-black/10 bg-white/70 p-5"
            >
              <ShieldCheck className="h-5 w-5 text-[#155e63]" />
              <h3 className="app-title mt-4 text-xl">{highlight.title}</h3>
              <p className="app-copy mt-3 text-sm">{highlight.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta grid gap-5 rounded-xl border border-black/10 p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
        <div>
          <span className="font-mono text-xs uppercase text-[#f3d8c9]">
            Start with one workspace
          </span>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">
            Build a Reddit growth routine you can repeat tomorrow.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#f4eee6]">
            Open the dashboard, set up a project, and let the workspace turn
            live conversations into the day&apos;s clearest moves.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="app-button app-button-primary min-w-44"
            style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
          >
            Open dashboard
          </Link>
          <Link
            href={isClerkConfigured ? "/sign-up" : "/dashboard"}
            className="app-button bg-white text-[#14110f] hover:bg-[#fff7ed]"
            style={{ color: "#14110f", WebkitTextFillColor: "#14110f" }}
          >
            {isClerkConfigured ? "Create account" : "Explore preview"}
          </Link>
        </div>
      </section>
    </main>
  );
}

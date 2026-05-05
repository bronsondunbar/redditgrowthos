import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";

import { isClerkConfigured } from "@/lib/config";

const outcomes = [
  {
    title: "See buyer language before you write",
    copy: "Track active threads, pain points, and objection patterns so your replies sound native to the conversation instead of dropped in from a template.",
  },
  {
    title: "Work from a daily operating plan",
    copy: "Turn discovery into a clear next move: one post worth publishing, two comments worth answering, and fewer tabs fighting for attention.",
  },
  {
    title: "Stay useful without over-promoting",
    copy: "Use reply drafts and risk notes to help first, mention the product second, and avoid burning trust in communities that could become long-term channels.",
  },
];

const proof = [
  "One workspace for multiple products or clients",
  "Live thread scoring and subreddit safety cues",
  "Reply drafting, post drafting, and tracked follow-up",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <section className="app-panel grid gap-8 p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
        <div className="space-y-6">
          <span className="app-kicker">Founder-focused Reddit operating system</span>

          <div className="space-y-4">
            <h1 className="app-title max-w-4xl text-5xl sm:text-6xl">
              Find live demand on Reddit and turn it into today&apos;s growth
              plan.
            </h1>
            <p className="app-copy max-w-2xl text-lg">
              RedditGrowthOS helps founders spot active buying intent, prioritize
              the right threads, and draft useful responses without rebuilding
              the workflow from scratch every morning.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="app-button app-button-primary min-w-44 gap-2"
              style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
            >
              Enter workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={isClerkConfigured ? "/sign-in" : "/dashboard"}
              className="app-button app-button-secondary min-w-40"
              style={{ color: "#14110f", WebkitTextFillColor: "#14110f" }}
            >
              {isClerkConfigured ? "Sign in" : "Preview without auth"}
            </Link>
          </div>

          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            {proof.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-black/10 bg-white/64 p-4 text-sm leading-6 text-[#4f4740]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel-strong grid gap-4 p-6">
          <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#cfe3e4]">
                  Today&apos;s operating rhythm
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  One channel. Three clear moves.
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                <Radar className="h-5 w-5" strokeWidth={2.2} />
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              "Post where founder pain is already visible.",
              "Reply to a fresh thread with helpful context first.",
              "Save high-risk conversations for later follow-up.",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-start gap-4 rounded-[22px] border border-white/10 bg-[#12484c] p-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-7 text-[#e6f2f2]">{step}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#cfe3e4]">
                Intent signals
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                Ranked daily
              </p>
              <p className="mt-2 text-sm leading-6 text-[#d4e7e7]">
                Prioritize threads by urgency, fit, and safety.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#cfe3e4]">
                Draft support
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                Help-first copy
              </p>
              <p className="mt-2 text-sm leading-6 text-[#d4e7e7]">
                Keep answers credible while still moving toward pipeline.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {outcomes.map((outcome) => (
          <article key={outcome.title} className="app-panel-muted p-6">
            <h2 className="app-title text-2xl">{outcome.title}</h2>
            <p className="app-copy mt-3 text-sm">{outcome.copy}</p>
          </article>
        ))}
      </section>

      <section className="app-panel grid gap-6 p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:p-10">
        <div>
          <span className="app-kicker">Why teams keep this open all day</span>
          <h2 className="app-title mt-4 text-3xl sm:text-4xl">
            Less hunting. More useful participation.
          </h2>
          <p className="app-copy mt-4 max-w-2xl text-base">
            Most Reddit workflows break because discovery, drafting, and follow-up
            live in different places. This product keeps the signal, the context,
            and the next action in one calm workspace.
          </p>
        </div>

        <div className="grid gap-4">
          {[
            {
              label: "Workspace structure",
              copy: "Switch between products without losing separate keywords, threads, and saved drafts.",
            },
            {
              label: "Action queue",
              copy: "Get a small set of worthwhile actions instead of a noisy stream of possibilities.",
            },
            {
              label: "Operational memory",
              copy: "Track posts and draft replies so good opportunities do not disappear into browser tabs.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-black/10 bg-[#f7f1e7] p-5"
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8b8278]">
                {item.label}
              </p>
              <p className="mt-3 text-base leading-7 text-[#4f4740]">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel flex flex-col gap-5 p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
        <div>
          <span className="app-kicker">Start with one workspace</span>
          <h2 className="app-title mt-4 text-3xl">
            Build a repeatable Reddit growth routine.
          </h2>
          <p className="app-copy mt-3 max-w-2xl text-base">
            Open the dashboard, set up a project, and let the workspace turn live
            conversations into a daily operating loop.
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
            className="app-button app-button-secondary min-w-40"
            style={{ color: "#14110f", WebkitTextFillColor: "#14110f" }}
          >
            {isClerkConfigured ? "Create account" : "Explore preview"}
          </Link>
        </div>
      </section>
    </main>
  );
}

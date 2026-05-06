import Image from "next/image";
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

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <section className="landing-hero relative isolate overflow-hidden rounded-xl border border-black/10">
        <Image
          src="/redditgrowthos-hero.png"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,11,11,0.88)_0%,rgba(18,23,23,0.74)_34%,rgba(20,17,15,0.22)_72%,rgba(20,17,15,0.12)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(217,93,57,0.2),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0)_62%,rgba(0,0,0,0.36)_100%)]" />

        <div className="relative flex min-h-[430px] flex-col justify-between gap-12 p-6 text-white sm:min-h-[520px] sm:p-8 lg:min-h-[610px] lg:p-10">
          <div className="max-w-3xl pt-10 sm:pt-14 lg:pt-20">
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
          </div>

          <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
            {proofPoints.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-white/16 bg-black/28 p-4 text-sm leading-6 text-[#fffaf3] backdrop-blur"
              >
                <CheckCircle2 className="mb-3 h-5 w-5 text-[#f47a2f]" />
                {item}
              </div>
            ))}
          </div>
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

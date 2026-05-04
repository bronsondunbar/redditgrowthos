import Link from "next/link";
import { Radar } from "lucide-react";

import { isClerkConfigured } from "@/lib/config";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <section className="grid gap-6 rounded-[40px] border border-black/10 bg-[#fffaf0]/92 p-8 shadow-[0_24px_80px_rgba(20,17,15,0.12)] lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1 font-mono text-xs uppercase tracking-[0.24em] text-[#6f675f]">
            Founder-focused Reddit operating system
          </span>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-[#14110f] sm:text-6xl">
              The only Reddit tool that finds demand and turns it into
              today&apos;s execution plan.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#4f4740]">
              <span className="mr-2 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 align-middle text-sm font-medium text-[#14110f]">
                <Radar className="h-4 w-4 text-[#155e63]" strokeWidth={2.2} />
                RedditGrowthOS
              </span>
              helps founders find live Reddit demand, rank the best threads,
              draft thoughtful replies, and decide what to do next without
              piecing together a manual workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex min-w-44 items-center justify-center rounded-full bg-[#14110f] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(20,17,15,0.22)] transition hover:bg-[#2c2622]"
              style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
            >
              Enter dashboard
            </Link>
            <Link
              href={isClerkConfigured ? "/sign-in" : "/dashboard"}
              className="inline-flex min-w-36 items-center justify-center rounded-full border border-black/12 bg-white px-6 py-3 text-sm font-semibold text-[#14110f] shadow-[inset_0_0_0_1px_rgba(20,17,15,0.02)] transition hover:bg-black/5"
              style={{ color: "#14110f", WebkitTextFillColor: "#14110f" }}
            >
              {isClerkConfigured ? "Sign in" : "Preview without auth"}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 rounded-[32px] bg-[#14110f] p-5 text-[#f3efe4]">
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#cfc7bc]">
              Today&apos;s three actions
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#efe8df]">
              <div className="rounded-2xl bg-white/8 px-4 py-3">
                1. Publish one story post in a safe subreddit.
              </div>
              <div className="rounded-2xl bg-white/8 px-4 py-3">
                2. Reply to a fresh high-intent thread with a soft CTA.
              </div>
              <div className="rounded-2xl bg-white/8 px-4 py-3">
                3. Save one risky thread for observation instead of forcing a
                pitch.
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#cfc7bc]">
                Opportunity finder
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                Fresh threads
              </p>
              <p className="mt-2 text-sm text-[#d3cbc0]">
                Track alternatives, pain points, and buyer language.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#cfc7bc]">
                AI reply engine
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                Soft pitch
              </p>
              <p className="mt-2 text-sm text-[#d3cbc0]">
                Draft answers that help first and mention the product second.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Daily action plan",
            copy: "One post and two comments generated from actual opportunities instead of a blank content calendar.",
          },
          {
            title: "Subreddit discovery",
            copy: "Rank subreddits by engagement, intent, and a promo-friendliness heuristic so you stop guessing where to show up.",
          },
          {
            title: "Inbox workflow",
            copy: "Move threads from new to saved to replied so lead discovery does not collapse into tab chaos.",
          },
        ].map((feature) => (
          <article
            key={feature.title}
            className="rounded-[28px] border border-black/10 bg-white/88 p-6 shadow-[0_16px_40px_rgba(20,17,15,0.06)]"
          >
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14110f]">
              {feature.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#4f4740]">
              {feature.copy}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

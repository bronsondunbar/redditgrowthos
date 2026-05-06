import Link from "next/link";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

import { BrandMark } from "@/components/brand-mark";
import { appConfig, isClerkConfigured } from "@/lib/config";

type AppShellProps = {
  children: React.ReactNode;
};

function BrandBlock() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <BrandMark className="h-9 w-9 shrink-0" />
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
          {appConfig.name}
        </p>
      </div>
      <p className="mt-1 text-sm text-[#5b524a]">
        Find leads on Reddit and know exactly what to do daily.
      </p>
    </div>
  );
}

function SharedNavLinks() {
  return (
    <Link
      href="/"
      className="rounded-full px-4 py-2 text-sm font-medium text-[#14110f] transition hover:bg-black/5"
    >
      Home
    </Link>
  );
}

function AuthActions() {
  if (!isClerkConfigured) {
    return (
      <Link
        href="/dashboard"
        className="app-button app-button-primary min-w-40"
        style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
      >
        Open preview
      </Link>
    );
  }

  return (
    <>
      <SignedOut>
        <div className="flex items-center gap-3">
          <SignInButton mode="modal">
            <button
              className="app-button app-button-secondary min-w-32"
              style={{ color: "#14110f", WebkitTextFillColor: "#14110f" }}
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              className="app-button app-button-primary min-w-40"
              style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
            >
              Create account
            </button>
          </SignUpButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="app-button app-button-primary min-w-44"
            style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
          >
            Open workspace
          </Link>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-10 w-10",
              },
            }}
          />
        </div>
      </SignedIn>
    </>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell-bg relative flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 px-6 pt-4 lg:px-10 lg:pt-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 rounded-[28px] border border-black/10 bg-[#fffdf8]/92 px-5 py-4 shadow-[0_10px_26px_rgba(20,17,15,0.05)] backdrop-blur">
          <Link href="/" className="min-w-0">
            <BrandBlock />
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex items-center gap-1">
              <SharedNavLinks />
            </nav>
            <AuthActions />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="px-6 pb-6 pt-10 lg:px-10 lg:pb-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 rounded-[28px] border border-black/10 bg-[#fffdf8]/88 px-6 py-6 shadow-[0_10px_28px_rgba(20,17,15,0.04)] md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark className="h-9 w-9 shrink-0" />
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8b8278]">
                {appConfig.name}
              </p>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b524a]">
              Opportunity discovery, reply drafting, and daily Reddit execution
              in one workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[#5b524a]">
            <Link href="/" className="app-link-subtle">
              Home
            </Link>
            <Link href="/dashboard" className="app-link-subtle">
              Dashboard
            </Link>
            <Link
              href={isClerkConfigured ? "/sign-in" : "/dashboard"}
              className="app-link-subtle"
            >
              {isClerkConfigured ? "Auth" : "Preview"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

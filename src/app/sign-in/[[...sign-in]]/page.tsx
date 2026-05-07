import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/config";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to RedditGrowthOS to access your Reddit opportunity workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignInPage() {
  if (!isClerkConfigured) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-6 py-16">
        <div className="app-panel w-full p-8">
          <span className="app-kicker">Authentication setup</span>
          <h1 className="app-title mt-4 text-3xl">
            Add Clerk keys to enable sign-in
          </h1>
          <p className="app-copy mt-4 text-base">
            Copy the values from Clerk into your environment file, restart the
            dev server, and this route will render the hosted auth flow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center justify-center px-6 py-16">
      <SignIn path="/sign-in" />
    </div>
  );
}

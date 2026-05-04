import { SignIn } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/config";

export default function SignInPage() {
  if (!isClerkConfigured) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-6 py-16">
        <div className="w-full rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(20,17,15,0.12)]">
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[#14110f]">
            Add Clerk keys to enable sign-in
          </h1>
          <p className="mt-4 text-base leading-7 text-[#4f4740]">
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

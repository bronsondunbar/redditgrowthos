import { SignUp } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/config";

export default function SignUpPage() {
  if (!isClerkConfigured) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-6 py-16">
        <div className="app-panel w-full p-8">
          <span className="app-kicker">Authentication setup</span>
          <h1 className="app-title mt-4 text-3xl">
            Add Clerk keys to enable sign-up
          </h1>
          <p className="app-copy mt-4 text-base">
            Once the publishable and secret keys are present, this route will
            render the sign-up flow automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center justify-center px-6 py-16">
      <SignUp path="/sign-up" />
    </div>
  );
}

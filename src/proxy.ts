import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/config";

const requiresAuth = createRouteMatcher(["/dashboard(.*)", "/api(.*)"]);

const configuredProxy = clerkMiddleware(async (auth, request) => {
  if (requiresAuth(request)) {
    await auth.protect();
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!isClerkConfigured) {
    return NextResponse.next();
  }

  return configuredProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

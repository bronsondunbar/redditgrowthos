import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { deleteTrackedPost } from "@/lib/store";

type RouteContext = {
  params: Promise<{
    trackedPostId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isClerkConfigured || !isDatabaseConfigured) {
      return NextResponse.json(
        { error: "Clerk or database is not configured." },
        { status: 500 },
      );
    }

    const session = await auth();

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { trackedPostId } = await context.params;
    const deleted = await deleteTrackedPost(trackedPostId, session.userId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Tracked post not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not delete the tracked post." },
      { status: 500 },
    );
  }
}

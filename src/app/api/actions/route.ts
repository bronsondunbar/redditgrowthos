import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { completeDailyAction, ensureUser } from "@/lib/store";

const completeActionSchema = z.object({
  projectId: z.string().trim().cuid(),
  actionId: z.string().trim().min(4).max(160),
  opportunityId: z.string().trim().cuid().nullable().optional(),
  opportunityStatus: z.enum(["NEW", "SAVED", "REPLIED", "DISMISSED"]).optional(),
});

export async function POST(request: Request) {
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

    const body = await request.json();
    const payload = completeActionSchema.parse(body);
    const user = await ensureUser(session.userId);
    const completed = await completeDailyAction({
      userId: user.id,
      projectId: payload.projectId,
      actionId: payload.actionId,
      opportunityId: payload.opportunityId,
      opportunityStatus: payload.opportunityStatus,
    });

    if (!completed) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid action payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not complete the action." },
      { status: 500 },
    );
  }
}

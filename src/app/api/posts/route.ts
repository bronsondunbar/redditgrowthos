import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { fetchTrackedRedditPost } from "@/lib/reddit";
import { saveTrackedPost } from "@/lib/store";

const trackedPostSchema = z.object({
  projectId: z.string().trim().cuid().nullable().optional(),
  permalink: z.string().trim().url(),
});

async function buildTrackedPostResponse(request: Request) {
  const body = await request.json();
  const payload = trackedPostSchema.parse(body);
  const trackedPost = await fetchTrackedRedditPost(payload.permalink);

  if (isClerkConfigured && isDatabaseConfigured) {
    const session = await auth();

    if (session.userId) {
      const savedPost = await saveTrackedPost(
        {
          projectId: payload.projectId,
          trackedPost,
        },
        session.userId,
      );

      return NextResponse.json({ trackedPost: savedPost, persisted: true });
    }
  }

  return NextResponse.json({ trackedPost, persisted: false });
}

export async function POST(request: Request) {
  try {
    return await buildTrackedPostResponse(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid Reddit post URL." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not track that Reddit post right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    return await buildTrackedPostResponse(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid Reddit post URL." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not refresh that Reddit post right now." },
      { status: 500 },
    );
  }
}

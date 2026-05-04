import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { generatePostSuggestion, reviewPostAgainstRules } from "@/lib/ai";
import { fetchSubredditRules } from "@/lib/reddit";
import { savePostDraft } from "@/lib/store";

const postSchema = z.object({
  projectId: z.string().trim().cuid().nullable().optional(),
  actionKey: z.string().trim().min(4).max(120).optional().default(""),
  productName: z.string().trim().min(2).max(80),
  productDescription: z.string().trim().min(12).max(500),
  subreddit: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(4).max(300),
  riskNote: z.string().trim().min(4).max(300),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = postSchema.parse(body);
    const result = await generatePostSuggestion(payload);
    const rules = await fetchSubredditRules(payload.subreddit);
    const review = await reviewPostAgainstRules({
      subreddit: payload.subreddit,
      rules,
      title: result.title,
      body: result.body,
    });

    if (
      isClerkConfigured &&
      isDatabaseConfigured &&
      payload.projectId &&
      payload.actionKey
    ) {
      const session = await auth();

      if (session.userId) {
        await savePostDraft(
          {
            projectId: payload.projectId,
            actionKey: payload.actionKey,
            subreddit: payload.subreddit,
            title: result.title,
            body: result.body,
            rules,
            review,
          },
          session.userId,
        );
      }
    }

    return NextResponse.json({
      ...result,
      rules,
      review,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid post draft payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not generate a post draft." },
      { status: 500 },
    );
  }
}

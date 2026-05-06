import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import {
  generateCommentReplySuggestion,
  generatePostCommentSuggestion,
  generateReplySuggestion,
} from "@/lib/ai";
import {
  fetchRedditCommentReplyContext,
  fetchRedditPostCommentContext,
} from "@/lib/reddit";
import { saveReplyDraft } from "@/lib/store";

const opportunityReplySchema = z.object({
  opportunityId: z.string().trim().cuid().nullable().optional(),
  productName: z.string().trim().min(2).max(80),
  productDescription: z.string().trim().min(12).max(500),
  subreddit: z.string().trim().min(2).max(60),
  title: z.string().trim().min(4).max(300),
  excerpt: z.string().trim().min(1).max(4000),
});

const commentReplySchema = z.object({
  productName: z.string().trim().min(2).max(80),
  productDescription: z.string().trim().min(12).max(500),
  postUrl: z.string().trim().url(),
  commentUrl: z.string().trim().url(),
});

const postCommentSchema = z.object({
  productName: z.string().trim().min(2).max(80),
  productDescription: z.string().trim().min(12).max(500),
  postUrl: z.string().trim().url(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if ("postUrl" in body && "commentUrl" in body) {
      const payload = commentReplySchema.parse(body);
      const context = await fetchRedditCommentReplyContext(
        payload.postUrl,
        payload.commentUrl,
      );
      const result = await generateCommentReplySuggestion({
        productName: payload.productName,
        productDescription: payload.productDescription,
        ...context,
      });

      return NextResponse.json({
        ...result,
        context,
      });
    }

    if ("postUrl" in body) {
      const payload = postCommentSchema.parse(body);
      const context = await fetchRedditPostCommentContext(payload.postUrl);
      const result = await generatePostCommentSuggestion({
        productName: payload.productName,
        productDescription: payload.productDescription,
        ...context,
      });

      return NextResponse.json({
        ...result,
        context,
      });
    }

    const payload = opportunityReplySchema.parse(body);
    const result = await generateReplySuggestion(payload);

    if (isClerkConfigured && isDatabaseConfigured && payload.opportunityId) {
      const session = await auth();

      if (session.userId) {
        await saveReplyDraft(
          {
            opportunityId: payload.opportunityId,
            reply: result.reply,
            softPromotionScore: result.softPromotionScore,
          },
          session.userId,
        );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid reply payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not generate a reply.",
      },
      { status: 500 },
    );
  }
}

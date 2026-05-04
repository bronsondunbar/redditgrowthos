import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { generateReplySuggestion } from "@/lib/ai";
import { saveReplyDraft } from "@/lib/store";

const replySchema = z.object({
  opportunityId: z.string().trim().cuid().nullable().optional(),
  productName: z.string().trim().min(2).max(80),
  productDescription: z.string().trim().min(12).max(500),
  subreddit: z.string().trim().min(2).max(60),
  title: z.string().trim().min(4).max(300),
  excerpt: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = replySchema.parse(body);
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
      { error: "Could not generate a reply." },
      { status: 500 },
    );
  }
}

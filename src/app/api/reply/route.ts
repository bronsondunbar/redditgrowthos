import { NextResponse } from "next/server";
import { z } from "zod";

import { generateReplySuggestion } from "@/lib/ai";

const replySchema = z.object({
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

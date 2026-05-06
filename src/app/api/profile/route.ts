import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ensureUser } from "@/lib/store";
import { isValidSubredditName, parseSubredditList } from "@/lib/subreddits";

const profileSchema = z.object({
  excludedSubreddits: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default("")
    .transform(parseSubredditList)
    .refine(
      (value) => value.every(isValidSubredditName),
      "Use valid subreddit names separated by commas or new lines.",
    ),
});

export async function PATCH(request: Request) {
  try {
    if (!isClerkConfigured || !isDatabaseConfigured || !prisma) {
      return NextResponse.json(
        { error: "Clerk or database is not configured." },
        { status: 500 },
      );
    }

    const session = await auth();

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = profileSchema.parse(await request.json());
    const user = await ensureUser(session.userId);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        excludedSubreddits: payload.excludedSubreddits,
      },
    });

    return NextResponse.json({
      excludedSubreddits: payload.excludedSubreddits,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || "Invalid profile payload.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not update the Reddit profile settings." },
      { status: 500 },
    );
  }
}

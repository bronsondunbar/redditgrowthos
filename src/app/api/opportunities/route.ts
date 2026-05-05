import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { RedditDiscoveryError } from "@/lib/reddit";
import {
  persistDiscovery,
  refreshProjectDiscovery,
  runDiscovery,
} from "@/lib/store";

export const runtime = "nodejs";

const discoverySchema = z.object({
  projectId: z.string().trim().cuid().nullable().optional(),
  websiteUrl: z.string().trim().max(2048).optional().default(""),
  productName: z.string().trim().min(2).max(80),
  productDescription: z.string().trim().min(12).max(500),
  keywords: z
    .string()
    .trim()
    .min(3)
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    )
    .refine((value) => value.length > 0, "Add at least one keyword."),
});

const refreshDiscoverySchema = z.object({
  projectId: z.string().trim().cuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = discoverySchema.parse(body);
    const dashboard = await runDiscovery(payload);

    if (isClerkConfigured && isDatabaseConfigured) {
      const session = await auth();

      if (session.userId) {
        const persistedDashboard = await persistDiscovery(
          payload,
          session.userId,
          dashboard,
        );

        return NextResponse.json({
          dashboard: persistedDashboard,
          persisted: true,
        });
      }
    }

    return NextResponse.json({
      dashboard,
      persisted: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || "Invalid discovery payload.",
        },
        { status: 400 },
      );
    }

    if (error instanceof RedditDiscoveryError) {
      console.error("Opportunity discovery upstream failure", {
        message: error.message,
        causes: error.causeDetails,
      });

      return NextResponse.json(
        {
          error:
            "Reddit search failed from the deployment environment. Check the server logs for the upstream response.",
        },
        { status: 502 },
      );
    }

    console.error("Opportunity discovery failed", error);

    return NextResponse.json(
      {
        error: "Could not discover opportunities right now.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
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
    const payload = refreshDiscoverySchema.parse(body);
    const dashboard = await refreshProjectDiscovery(
      payload.projectId,
      session.userId,
    );

    if (!dashboard) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ dashboard, persisted: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || "Invalid refresh payload.",
        },
        { status: 400 },
      );
    }

    if (error instanceof RedditDiscoveryError) {
      console.error("Opportunity refresh upstream failure", {
        message: error.message,
        causes: error.causeDetails,
      });

      return NextResponse.json(
        {
          error:
            "Reddit search failed from the deployment environment. Check the server logs for the upstream response.",
        },
        { status: 502 },
      );
    }

    console.error("Opportunity refresh failed", error);

    return NextResponse.json(
      {
        error: "Could not refresh discovery right now.",
      },
      { status: 500 },
    );
  }
}

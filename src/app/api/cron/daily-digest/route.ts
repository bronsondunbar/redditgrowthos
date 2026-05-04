import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

import {
  cronSecret,
  isClerkConfigured,
  isDatabaseConfigured,
  isResendConfigured,
  resendFromEmail,
} from "@/lib/config";
import { buildDailyDigestEmail } from "@/lib/daily-digest";
import { prisma } from "@/lib/prisma";
import { refreshProjectDiscovery } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorizedResponse();
  }

  if (
    !isClerkConfigured ||
    !isDatabaseConfigured ||
    !isResendConfigured ||
    !prisma ||
    !resend
  ) {
    return Response.json(
      { error: "Clerk, database, or Resend is not configured." },
      { status: 500 },
    );
  }

  const users = await prisma.user.findMany({
    where: {
      projects: {
        some: {},
      },
    },
    select: {
      id: true,
      clerkId: true,
      projects: {
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
        },
      },
    },
  });

  const client = await clerkClient();
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const clerkUser = await client.users
      .getUser(user.clerkId)
      .catch(() => null);
    const recipientEmail =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress;

    if (!recipientEmail) {
      skipped += 1;
      continue;
    }

    const projects = [];

    for (const project of user.projects) {
      const refreshedProject = await refreshProjectDiscovery(
        project.id,
        user.id,
      ).catch(() => null);

      if (!refreshedProject?.currentProjectId) {
        continue;
      }

      if (
        !refreshedProject.actions.length &&
        !refreshedProject.trackedPosts.length
      ) {
        continue;
      }

      projects.push({
        name: refreshedProject.productName,
        websiteUrl: refreshedProject.websiteUrl || "",
        actions: refreshedProject.actions.slice(0, 3),
        trackedPosts: refreshedProject.trackedPosts.slice(0, 3),
      });
    }

    if (!projects.length) {
      skipped += 1;
      continue;
    }

    const digest = buildDailyDigestEmail({
      recipientName: clerkUser?.firstName || clerkUser?.username || "there",
      projects,
    });

    await resend.emails.send({
      from: resendFromEmail,
      to: recipientEmail,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
    });

    sent += 1;
  }

  return Response.json({ ok: true, sent, skipped });
}

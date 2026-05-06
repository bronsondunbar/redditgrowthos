import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isClerkConfigured, isDatabaseConfigured } from "@/lib/config";
import { deleteProject } from "@/lib/store";

const projectIdSchema = z.string().trim().cuid();

type RouteContext = {
  params: Promise<{
    projectId: string;
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

    const { projectId } = await context.params;
    const dashboard = await deleteProject(
      projectIdSchema.parse(projectId),
      session.userId,
    );

    if (!dashboard) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ dashboard });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid project id." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not delete the project." },
      { status: 500 },
    );
  }
}

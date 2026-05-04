import { NextResponse } from "next/server";
import { z } from "zod";

import { updateOpportunityStatus } from "@/lib/store";

const statusSchema = z.object({
  status: z.enum(["NEW", "SAVED", "REPLIED", "DISMISSED"]),
});

type RouteContext = {
  params: Promise<{
    opportunityId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { opportunityId } = await context.params;
    const body = await request.json();
    const payload = statusSchema.parse(body);
    const updated = await updateOpportunityStatus(
      opportunityId,
      payload.status,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid status payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not update workflow state." },
      { status: 500 },
    );
  }
}

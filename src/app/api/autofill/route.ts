import { NextResponse } from "next/server";
import { z } from "zod";

import { extractWebsiteIntake } from "@/lib/site-intake";

const autofillSchema = z.object({
  url: z.string().trim().min(3).max(2048),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = autofillSchema.parse(body);
    const result = await extractWebsiteIntake(payload.url);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Enter a valid URL." },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not autofill from that URL." },
      { status: 500 },
    );
  }
}

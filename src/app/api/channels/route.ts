import { NextResponse } from "next/server";
import { listChannels } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json(
      { error: "Missing SLACK_BOT_TOKEN environment variable" },
      { status: 500 }
    );
  }

  try {
    const channels = await listChannels();
    return NextResponse.json(channels);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Slack API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

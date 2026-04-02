import { NextResponse } from "next/server";
import { getChannelAnalytics } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
    return NextResponse.json(
      { error: "Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID environment variables" },
      { status: 500 }
    );
  }

  try {
    const analytics = await getChannelAnalytics();
    return NextResponse.json(analytics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Slack API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

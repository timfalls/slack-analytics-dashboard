import { NextRequest, NextResponse } from "next/server";
import { getChannelAnalytics } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json(
      { error: "Missing SLACK_BOT_TOKEN environment variable" },
      { status: 500 }
    );
  }

  const channelId =
    request.nextUrl.searchParams.get("channel") ||
    process.env.SLACK_CHANNEL_ID;

  if (!channelId) {
    return NextResponse.json(
      { error: "Missing channel ID (pass ?channel= or set SLACK_CHANNEL_ID)" },
      { status: 400 }
    );
  }

  try {
    const analytics = await getChannelAnalytics(channelId);
    return NextResponse.json(analytics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Slack API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const channelId = process.env.SLACK_CHANNEL_ID!;

export interface ChannelAnalytics {
  channelName: string;
  totalMembers: number;
  membersDelta: number | null;
  newMembersThisWeek: string[];
  totalMessages: number;
  uniquePosters: number;
  membersWhoPosted: string[];
  viewerCount: number | null; // null if not on Enterprise Grid
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
}

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function getChannelAnalytics(): Promise<ChannelAnalytics> {
  // Get channel info
  const channelInfo = await slack.conversations.info({ channel: channelId });
  const channelName = channelInfo.channel?.name ?? "unknown";

  // Get all members
  const members: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await slack.conversations.members({
      channel: channelId,
      limit: 200,
      cursor,
    });
    members.push(...(res.members ?? []));
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);

  const totalMembers = members.length;

  // Determine the current week window (Monday 00:00 UTC to now)
  const weekStart = startOfWeek();
  const now = new Date();
  const oldest = (weekStart.getTime() / 1000).toString();
  const latest = (now.getTime() / 1000).toString();

  // Fetch messages for the current week
  const messages: { user?: string; ts: string; subtype?: string }[] = [];
  let msgCursor: string | undefined;
  do {
    const res = await slack.conversations.history({
      channel: channelId,
      oldest,
      latest,
      limit: 200,
      cursor: msgCursor,
    });
    messages.push(
      ...((res.messages as { user?: string; ts: string; subtype?: string }[]) ??
        [])
    );
    msgCursor = res.response_metadata?.next_cursor || undefined;
  } while (msgCursor);

  // Filter to real user messages (exclude bot messages, join/leave, etc.)
  const userMessages = messages.filter((m) => m.user && !m.subtype);
  const totalMessages = userMessages.length;

  const posterSet = new Set(userMessages.map((m) => m.user!));
  const uniquePosters = posterSet.size;

  // Resolve poster display names
  const membersWhoPosted: string[] = [];
  for (const userId of posterSet) {
    try {
      const userInfo = await slack.users.info({ user: userId });
      membersWhoPosted.push(
        userInfo.user?.profile?.display_name ||
          userInfo.user?.real_name ||
          userId
      );
    } catch {
      membersWhoPosted.push(userId);
    }
  }

  // Detect new members this week via channel_join messages
  const joinMessages = messages.filter((m) => m.subtype === "channel_join");
  const newMemberIds = joinMessages.map((m) => m.user!).filter(Boolean);
  const newMembersThisWeek: string[] = [];
  for (const userId of newMemberIds) {
    try {
      const userInfo = await slack.users.info({ user: userId });
      newMembersThisWeek.push(
        userInfo.user?.profile?.display_name ||
          userInfo.user?.real_name ||
          userId
      );
    } catch {
      newMembersThisWeek.push(userId);
    }
  }

  return {
    channelName,
    totalMembers,
    membersDelta: null, // Would need historical data to compute
    newMembersThisWeek,
    totalMessages,
    uniquePosters,
    membersWhoPosted,
    viewerCount: null, // Requires Enterprise Grid analytics API
    fetchedAt: now.toISOString(),
    periodStart: weekStart.toISOString(),
    periodEnd: now.toISOString(),
  };
}

import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const DEFAULT_WINSLOW_MEMBERS = [
  "Ashley Kera",
  "dalton",
  "nielr1",
  "Sara McConnell",
  "Tim",
];

function getWinslowMembers(): string[] {
  const env = process.env.WINSLOW_TEAM_MEMBERS;
  if (env) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_WINSLOW_MEMBERS;
}

function isWinslowMember(displayName: string, realName: string): boolean {
  const winslowNames = getWinslowMembers();
  const lower = winslowNames.map((n) => n.toLowerCase());
  return (
    lower.includes(displayName.toLowerCase()) ||
    lower.includes(realName.toLowerCase())
  );
}

export interface MemberInfo {
  userId: string;
  displayName: string;
  realName: string;
  isWinslow: boolean;
  messageCount: number;
  joinedDate: string | null;
}

export interface DailyMessages {
  date: string; // YYYY-MM-DD
  winslow: number;
  nonWinslow: number;
}

export interface ChannelAnalytics {
  channelName: string;
  totalMembers: number;
  totalMessages: number;
  totalNonWinslowUsers: number;
  activeNonWinslowUsers: number;
  activeNonWinslowPercent: number;
  // Your original metrics
  totalExternalMembers: number;
  membersDelta: number | null; // vs prior week — null until we have historical data
  newMembersThisWeek: string[];
  uniquePosters: number;
  membersWhoPosted: string[];
  // Full data
  members: MemberInfo[];
  messagesPerDay: DailyMessages[];
  leaderboard: MemberInfo[];
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
}

async function resolveUser(
  userId: string
): Promise<{ displayName: string; realName: string }> {
  try {
    const info = await slack.users.info({ user: userId });
    return {
      displayName:
        info.user?.profile?.display_name || info.user?.real_name || userId,
      realName: info.user?.real_name || userId,
    };
  } catch {
    return { displayName: userId, realName: userId };
  }
}

export async function getChannelAnalytics(
  channelId: string
): Promise<ChannelAnalytics> {
  // Get channel info
  const channelInfo = await slack.conversations.info({ channel: channelId });
  const channelName = channelInfo.channel?.name ?? "unknown";

  // Get all member IDs
  const memberIds: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await slack.conversations.members({
      channel: channelId,
      limit: 200,
      cursor,
    });
    memberIds.push(...(res.members ?? []));
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);

  // 30-day window
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setUTCDate(now.getUTCDate() - 30);
  periodStart.setUTCHours(0, 0, 0, 0);
  const oldest = (periodStart.getTime() / 1000).toString();
  const latest = (now.getTime() / 1000).toString();

  // Fetch all messages in the 30-day window
  const allMessages: {
    user?: string;
    ts: string;
    subtype?: string;
    text?: string;
  }[] = [];
  let msgCursor: string | undefined;
  do {
    const res = await slack.conversations.history({
      channel: channelId,
      oldest,
      latest,
      limit: 200,
      cursor: msgCursor,
    });
    allMessages.push(
      ...(res.messages as typeof allMessages) ?? []
    );
    msgCursor = res.response_metadata?.next_cursor || undefined;
  } while (msgCursor);

  // Separate user messages and join messages
  const userMessages = allMessages.filter((m) => m.user && !m.subtype);
  const joinMessages = allMessages.filter((m) => m.subtype === "channel_join");

  // Build a map of userId -> join date from channel_join messages
  const joinDateMap = new Map<string, string>();
  for (const msg of joinMessages) {
    if (msg.user && !joinDateMap.has(msg.user)) {
      const date = new Date(parseFloat(msg.ts) * 1000);
      joinDateMap.set(msg.user, date.toISOString());
    }
  }

  // Also scan older history for join dates of existing members if possible
  // (We'll use what we have from the 30-day window; older joins won't show)

  // Resolve all member profiles
  const userCache = new Map<
    string,
    { displayName: string; realName: string }
  >();
  const allUserIds = new Set([
    ...memberIds,
    ...userMessages.map((m) => m.user!),
  ]);
  await Promise.all(
    [...allUserIds].map(async (uid) => {
      const info = await resolveUser(uid);
      userCache.set(uid, info);
    })
  );

  // Count messages per user
  const messageCounts = new Map<string, number>();
  for (const msg of userMessages) {
    const uid = msg.user!;
    messageCounts.set(uid, (messageCounts.get(uid) ?? 0) + 1);
  }

  // Build member list
  const members: MemberInfo[] = memberIds.map((uid) => {
    const profile = userCache.get(uid) ?? {
      displayName: uid,
      realName: uid,
    };
    return {
      userId: uid,
      displayName: profile.displayName,
      realName: profile.realName,
      isWinslow: isWinslowMember(profile.displayName, profile.realName),
      messageCount: messageCounts.get(uid) ?? 0,
      joinedDate: joinDateMap.get(uid) ?? null,
    };
  });

  // Classify messages by day and Winslow/Non-Winslow
  const dailyMap = new Map<string, { winslow: number; nonWinslow: number }>();
  // Initialize all days in the 30-day range
  for (let d = new Date(periodStart); d <= now; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { winslow: 0, nonWinslow: 0 });
  }
  for (const msg of userMessages) {
    const date = new Date(parseFloat(msg.ts) * 1000);
    const key = date.toISOString().slice(0, 10);
    const entry = dailyMap.get(key);
    if (!entry) continue;
    const profile = userCache.get(msg.user!);
    if (
      profile &&
      isWinslowMember(profile.displayName, profile.realName)
    ) {
      entry.winslow++;
    } else {
      entry.nonWinslow++;
    }
  }
  const messagesPerDay: DailyMessages[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  // Stats
  const nonWinslowMembers = members.filter((m) => !m.isWinslow);
  const totalNonWinslowUsers = nonWinslowMembers.length;
  const activeNonWinslowUsers = nonWinslowMembers.filter(
    (m) => m.messageCount > 0
  ).length;
  const activeNonWinslowPercent =
    totalNonWinslowUsers > 0
      ? Math.round((activeNonWinslowUsers / totalNonWinslowUsers) * 100)
      : 0;

  // Leaderboard: top posters sorted by message count
  const leaderboard = [...members]
    .filter((m) => m.messageCount > 0)
    .sort((a, b) => b.messageCount - a.messageCount);

  // Your original metrics
  const totalExternalMembers = nonWinslowMembers.length;
  const posterNames = leaderboard.map((m) => m.displayName);
  const uniquePosters = leaderboard.length;

  // New members this week (joined in the last 7 days)
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(now.getUTCDate() - 7);
  const newMembersThisWeek = members
    .filter((m) => m.joinedDate && new Date(m.joinedDate) >= weekAgo)
    .map((m) => m.displayName);

  return {
    channelName,
    totalMembers: memberIds.length,
    totalMessages: userMessages.length,
    totalNonWinslowUsers,
    activeNonWinslowUsers,
    activeNonWinslowPercent,
    // Your original metrics
    totalExternalMembers,
    membersDelta: null, // Requires weekly snapshots — future enhancement
    newMembersThisWeek,
    uniquePosters,
    membersWhoPosted: posterNames,
    // Full data
    members: members.sort((a, b) => {
      // Sort by joined date ascending, nulls last
      if (a.joinedDate && b.joinedDate)
        return a.joinedDate.localeCompare(b.joinedDate);
      if (a.joinedDate) return -1;
      if (b.joinedDate) return 1;
      return a.displayName.localeCompare(b.displayName);
    }),
    messagesPerDay,
    leaderboard,
    fetchedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
  };
}

export async function listChannels(): Promise<
  { id: string; name: string }[]
> {
  const channels: { id: string; name: string }[] = [];
  let cursor: string | undefined;
  do {
    const res = await slack.conversations.list({
      types: "public_channel",
      limit: 200,
      cursor,
    });
    for (const ch of res.channels ?? []) {
      if (ch.id && ch.name) {
        channels.push({ id: ch.id, name: ch.name });
      }
    }
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

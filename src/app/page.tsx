"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MemberInfo {
  userId: string;
  displayName: string;
  realName: string;
  isWinslow: boolean;
  messageCount: number;
  joinedDate: string | null;
}

interface DailyMessages {
  date: string;
  winslow: number;
  nonWinslow: number;
}

interface Analytics {
  channelName: string;
  totalMembers: number;
  totalMessages: number;
  totalNonWinslowUsers: number;
  activeNonWinslowUsers: number;
  activeNonWinslowPercent: number;
  totalExternalMembers: number;
  membersDelta: number | null;
  newMembersThisWeek: string[];
  uniquePosters: number;
  membersWhoPosted: string[];
  members: MemberInfo[];
  messagesPerDay: DailyMessages[];
  leaderboard: MemberInfo[];
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
}

interface Channel {
  id: string;
  name: string;
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>("joinedDate");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const list: Channel[] = await res.json();
        setChannels(list);
      }
    } catch {
      // channels list is optional
    }
  }, []);

  const fetchData = useCallback(
    async (channelId?: string) => {
      setLoading(true);
      try {
        const params = channelId ? `?channel=${channelId}` : "";
        const res = await fetch(`/api/analytics${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const analytics: Analytics = await res.json();
        setData(analytics);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchChannels();
    fetchData();
  }, [fetchChannels, fetchData]);

  useEffect(() => {
    if (!selectedChannel) return;
    fetchData(selectedChannel);
  }, [selectedChannel, fetchData]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "joinedDate");
    }
  };

  const sortedMembers = data
    ? [...data.members].sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        switch (sortField) {
          case "displayName":
            return dir * a.displayName.localeCompare(b.displayName);
          case "isWinslow":
            return dir * (Number(a.isWinslow) - Number(b.isWinslow));
          case "messageCount":
            return dir * (a.messageCount - b.messageCount);
          case "joinedDate": {
            if (!a.joinedDate && !b.joinedDate) return 0;
            if (!a.joinedDate) return 1;
            if (!b.joinedDate) return -1;
            return dir * a.joinedDate.localeCompare(b.joinedDate);
          }
          default:
            return 0;
        }
      })
    : [];

  const SortIndicator = ({ field }: { field: string }) => (
    <span className="ml-1 text-[var(--muted)]">
      {sortField === field ? (sortAsc ? "\u2191" : "\u2193") : "\u2195"}
    </span>
  );

  // Prepare chart data for messages by sender (horizontal bar)
  const senderChartData = data
    ? data.leaderboard.slice(0, 10).map((m) => ({
        name: m.displayName,
        winslow: m.isWinslow ? m.messageCount : 0,
        nonWinslow: m.isWinslow ? 0 : m.messageCount,
      }))
    : [];

  return (
    <div className="flex flex-col flex-1 font-sans">
      {/* Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--card)] px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              winslow-buildwithus-dashboard
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Slack channel analytics &middot; Last 30 days
            </p>
          </div>
          <div className="flex items-center gap-3">
            {channels.length > 0 && (
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
              >
                <option value="">
                  # {data?.channelName ?? "select channel"}
                </option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    # {ch.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => fetchData(selectedChannel || undefined)}
              disabled={loading}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard label="Total Members" value={data.totalMembers} />
              <StatCard label="Total Messages" value={data.totalMessages} />
              <StatCard
                label="Active Non-Winslow Users"
                value={data.activeNonWinslowUsers}
                subtitle={`${data.activeNonWinslowPercent}% of all non-Winslow users`}
              />
              <StatCard
                label="Total External Members"
                value={data.totalExternalMembers}
                subtitle={
                  data.membersDelta !== null
                    ? `${data.membersDelta >= 0 ? "+" : ""}${data.membersDelta} vs last week`
                    : undefined
                }
              />
              <StatCard
                label="New Members This Week"
                value={data.newMembersThisWeek.length}
                subtitle={
                  data.newMembersThisWeek.length > 0
                    ? data.newMembersThisWeek.join(", ")
                    : "None"
                }
              />
              <StatCard
                label="Members Who Posted"
                value={data.uniquePosters}
                subtitle={
                  data.membersWhoPosted.length > 0
                    ? data.membersWhoPosted.slice(0, 5).join(", ") +
                      (data.membersWhoPosted.length > 5
                        ? ` +${data.membersWhoPosted.length - 5} more`
                        : "")
                    : "None"
                }
              />
            </div>

            {/* Messages Per Day Chart */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
              <h2 className="mb-4 text-base font-semibold">Messages Per Day</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.messagesPerDay}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(label) => formatShortDate(label as string)}
                  />
                  <Legend />
                  <Bar
                    dataKey="nonWinslow"
                    name="Non-Winslow"
                    fill="#94a3b8"
                    stackId="a"
                  />
                  <Bar
                    dataKey="winslow"
                    name="Winslow"
                    fill="#f97316"
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Messages by Sender + Leaderboard */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Messages by Sender */}
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
                <h2 className="mb-4 text-base font-semibold">
                  Messages by Sender
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={senderChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="nonWinslow"
                      name="Non-Winslow"
                      fill="#94a3b8"
                      stackId="a"
                    />
                    <Bar
                      dataKey="winslow"
                      name="Winslow"
                      fill="#f97316"
                      stackId="a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Leaderboard */}
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
                <h2 className="mb-4 text-base font-semibold">
                  Leaderboard &mdash; Last 30 Days
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)] text-left text-xs text-[var(--muted)]">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">User</th>
                      <th className="pb-2 pr-2 text-right">Messages</th>
                      <th className="pb-2">Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((m, i) => (
                      <tr
                        key={m.userId}
                        className="border-b border-[var(--card-border)] last:border-0"
                      >
                        <td className="py-2 pr-2 text-[var(--muted)]">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-2 font-medium">
                          {m.displayName}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold">
                          {m.messageCount}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              m.isWinslow
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {m.isWinslow ? "Winslow" : "Non-Winslow"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* All Channel Members Table */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
              <h2 className="mb-4 text-base font-semibold">
                All Channel Members ({data.totalMembers})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)] text-left text-xs text-[var(--muted)]">
                      <th className="pb-2 pr-3">#</th>
                      <th
                        className="cursor-pointer pb-2 pr-3 select-none"
                        onClick={() => handleSort("displayName")}
                      >
                        Name
                        <SortIndicator field="displayName" />
                      </th>
                      <th
                        className="cursor-pointer pb-2 pr-3 select-none"
                        onClick={() => handleSort("isWinslow")}
                      >
                        Status
                        <SortIndicator field="isWinslow" />
                      </th>
                      <th
                        className="cursor-pointer pb-2 pr-3 text-right select-none"
                        onClick={() => handleSort("messageCount")}
                      >
                        Messages (30d)
                        <SortIndicator field="messageCount" />
                      </th>
                      <th
                        className="cursor-pointer pb-2 pr-3 select-none"
                        onClick={() => handleSort("joinedDate")}
                      >
                        Joined
                        <SortIndicator field="joinedDate" />
                      </th>
                      <th className="pb-2">Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.map((m, i) => (
                      <tr
                        key={m.userId}
                        className="border-b border-[var(--card-border)] last:border-0"
                      >
                        <td className="py-2.5 pr-3 text-[var(--muted)]">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-3 font-medium">
                          {m.displayName}
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--muted)]">
                          {m.isWinslow ? "Winslow" : "Non-Winslow"}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold">
                          {m.messageCount}
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--muted)]">
                          {m.joinedDate ? formatDate(m.joinedDate) : "\u2014"}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              m.isWinslow
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {m.isWinslow ? "Tag Winslow" : "Tag Winslow"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

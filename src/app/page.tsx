"use client";

import { useEffect, useState, useCallback } from "react";

interface Analytics {
  channelName: string;
  totalMembers: number;
  membersDelta: number | null;
  newMembersThisWeek: string[];
  totalMessages: number;
  uniquePosters: number;
  membersWhoPosted: string[];
  viewerCount: number | null;
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
}

function StatCard({
  label,
  value,
  delta,
  detail,
  subtitle,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  detail?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {delta !== undefined && delta !== null && (
          <span
            className={`text-sm font-semibold ${
              delta >= 0
                ? "text-[var(--positive)]"
                : "text-red-600"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta} vs last week
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      )}
      {detail && (
        <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">
          {detail}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="flex flex-col flex-1 font-sans">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Winslow Community Analytics
            </h1>
            {data && (
              <p className="text-sm text-[var(--muted)]">
                #{data.channelName}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
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
          <>
            <div className="mb-4 text-xs text-[var(--muted)]">
              Week of{" "}
              {new Date(data.periodStart).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              &ndash;{" "}
              {new Date(data.periodEnd).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" | "}
              Last updated{" "}
              {new Date(data.fetchedAt).toLocaleTimeString()}
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Total Members"
                value={data.totalMembers}
                delta={data.membersDelta}
                subtitle="External members in channel"
              />
              <StatCard
                label="New Members This Week"
                value={data.newMembersThisWeek.length}
                detail={
                  data.newMembersThisWeek.length > 0
                    ? data.newMembersThisWeek.join(", ")
                    : undefined
                }
              />
              <StatCard
                label="Messages Posted"
                value={data.totalMessages}
                subtitle="This week"
              />
              <StatCard
                label="Members Who Posted"
                value={data.uniquePosters}
                detail={
                  data.membersWhoPosted.length > 0
                    ? data.membersWhoPosted.join(", ")
                    : undefined
                }
              />
              <StatCard
                label="Members Who Viewed"
                value={data.viewerCount ?? "N/A"}
                subtitle={
                  data.viewerCount === null
                    ? "Requires Enterprise Grid"
                    : undefined
                }
              />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--card-border)] bg-[var(--card)] py-4 text-center text-xs text-[var(--muted)]">
        Winslow Ecosystem Tracker
      </footer>
    </div>
  );
}

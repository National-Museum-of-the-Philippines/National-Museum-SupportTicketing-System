import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import museumHeroUrl from "@/assets/nmp-museum-hero.png";
import type { ActivityRecord } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Maroon welcome card used at the top of a dashboard. */
export function OverviewHero({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="relative flex min-h-[15rem] flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-maroon-deep p-6 text-white shadow-[0_14px_34px_-12px_color-mix(in_oklab,var(--maroon-deep)_55%,transparent)] sm:p-8">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${museumHeroUrl})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--maroon-deep)_88%,transparent)_0%,color-mix(in_oklab,var(--maroon-deep)_60%,transparent)_40%,color-mix(in_oklab,var(--maroon-deep)_12%,transparent)_100%)]"
      />
      <div className="relative">
        <h1 className="text-balance [text-shadow:0_1px_12px_rgb(0_0_0/0.35)] text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {children ? (
          <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/90 [text-shadow:0_1px_8px_rgb(0_0_0/0.35)]">{children}</p>
        ) : null}
      </div>
      {actions ? <div className="relative flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}

const heroButton =
  "inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-maroon-deep";

export function HeroLink({
  to,
  children,
  variant = "solid",
}: {
  to: string;
  children: ReactNode;
  variant?: "solid" | "outline";
}) {
  return (
    <Link
      to={to}
      className={cn(
        heroButton,
        variant === "solid"
          ? "bg-white text-maroon-deep hover:bg-white/90"
          : "border border-white/40 text-white hover:bg-white/10",
      )}
    >
      {children}
    </Link>
  );
}

/** Compact horizontal stat tile: icon, label + hint, big number. */
export function OverviewStat({
  label,
  hint,
  value,
  to,
  icon: Icon,
  loading,
}: {
  label: string;
  hint: string;
  value: number;
  to: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-1 items-center gap-4 rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-maroon/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-maroon/10 text-maroon">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="text-3xl font-bold tabular-nums text-foreground">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : value}
      </span>
    </Link>
  );
}

const DOT_TONES = [
  { match: /closed|completed|confirmed|approved/, dot: "border-maroon-deep bg-maroon-deep" },
  { match: /reject|disapprov|reopen/, dot: "border-red-500 bg-red-500" },
  { match: /assign|status|started|process/, dot: "border-rose-500 bg-rose-500" },
];

function dotClass(action: string) {
  return (
    DOT_TONES.find((t) => t.match.test(action.toLowerCase()))?.dot ??
    "border-amber-500 bg-amber-500"
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const COLLAPSED_COUNT = 5;

/** Timeline of the activity that happened today. */
export function TodayActivity({
  items,
  loading,
}: {
  items: ActivityRecord[];
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const today = items.filter((i) => isToday(i.createdAt));
  const visible = expanded ? today : today.slice(0, COLLAPSED_COUNT);

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Today&rsquo;s activity</h2>
        {today.length > COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-medium text-maroon hover:underline"
          >
            {expanded ? "Show less" : `View all (${today.length})`}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-maroon" />
          Loading activity…
        </p>
      ) : today.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No activity yet today. Updates on requests and forms will show up here.
        </p>
      ) : (
        <ol className={cn("mt-5", expanded && "max-h-[26rem] overflow-y-auto pr-2")}>
          {visible.map((row, i) => {
            const last = i === visible.length - 1;
            return (
              <li key={row._id} className="relative flex gap-4 pb-6 last:pb-1">
                {!last ? (
                  <span
                    aria-hidden
                    className="absolute left-[0.6875rem] top-6 h-[calc(100%-1.25rem)] w-px bg-border"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current/30 bg-card"
                >
                  <span className={cn("h-3 w-3 rounded-full border", dotClass(row.action))} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                    {row.summary}
                  </p>
                  <time
                    dateTime={row.createdAt}
                    className="mt-0.5 block text-xs text-muted-foreground"
                  >
                    {new Date(row.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

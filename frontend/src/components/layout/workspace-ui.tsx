import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowUpRight, Info, Loader2 } from "lucide-react";
import type { CSSProperties, ReactNode, SelectHTMLAttributes } from "react";
import museumHeroUrl from "@/assets/nmp-museum-hero.png";
import { buttonVariants } from "@/components/ui/button";
import { formatTicketStatus, statusToneClass, ticketStatusTone } from "@/lib/ticket-status";
import type { FormStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const FORM_STATUS_LABEL: Record<FormStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  disapproved: "Disapproved",
};

const FORM_STATUS_TONE: Record<FormStatus, keyof typeof statusToneClass> = {
  draft: "neutral",
  pending_review: "warning",
  published: "success",
  disapproved: "danger",
};

export function WorkspacePageHeader({
  title,
  description,
  meta,
  actions,
  bordered = true,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        bordered && "page-hero",
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="action-tray shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}

export function ActionPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("action-panel", className)}>
      <div className="action-panel-header">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="action-panel-body">{children}</div>
    </div>
  );
}

export function FlowNotice({
  tone = "info",
  icon: Icon,
  title,
  children,
  action,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  icon?: LucideIcon;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flow-notice",
        tone === "success" && "flow-notice-success",
        tone === "warning" && "flow-notice-warning",
        tone === "info" && "flow-notice-info",
        tone === "danger" && "flow-notice-danger",
      )}
    >
      {Icon ? (
        <span className="flow-notice-icon">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-1", "text-sm opacity-90")}>{children}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function PanelLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="panel-loading">
      <Loader2 className="h-4 w-4 animate-spin text-maroon" />
      {label}
    </div>
  );
}

export function FormSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("form-select", className)} {...props}>
      {children}
    </select>
  );
}

export function PortalGateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="gate-page">
      <div className="portal-gate-card page-transition-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-maroon">
          Support Ticketing System
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {label}
    </div>
  );
}

export function BackLink({ to, label = "Back" }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:border-maroon/25 hover:bg-maroon/5 hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className="dashboard-hero"
      style={
        {
          ["--dashboard-hero-image" as string]: `url(${museumHeroUrl})`,
        } as CSSProperties
      }
    >
      <div className="dashboard-hero-media" aria-hidden />
      <div className="dashboard-hero-content flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <span className="dashboard-eyebrow">{eyebrow}</span> : null}
          <h1 className="mt-1.5 text-balance text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="action-tray shrink-0">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardAlert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "danger";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "danger" ? AlertCircle : tone === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "dashboard-alert group",
        tone === "warning" && "dashboard-alert-warning",
        tone === "danger" && "dashboard-alert-danger",
      )}
    >
      <div className="flex gap-3">
        <span className="dashboard-alert-icon">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ListRow({
  title,
  subtitle,
  trailing,
  action,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="list-row group relative flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground transition-colors group-hover:text-maroon">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground/70">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">{trailing}{action}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  to,
  icon: Icon,
  loading,
  accent = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  to?: string;
  icon?: LucideIcon;
  loading?: boolean;
  accent?: "default" | "warning" | "danger" | "success" | "info";
}) {
  const accentClass =
    accent === "warning"
      ? "stat-card-warning"
      : accent === "danger"
        ? "stat-card-danger"
        : accent === "success"
          ? "stat-card-success"
          : accent === "info"
            ? "stat-card-info"
            : "";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground/80">
          {label}
        </p>
        {Icon ? (
          <span className="stat-card-icon">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        <span className="stat-card-value">{loading ? "…" : value}</span>
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {to ? (
        <span className="stat-card-arrow" aria-hidden>
          <span className="stat-card-footer-label">View all</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn("stat-card stat-card-link group block", accentClass)}>
        {content}
      </Link>
    );
  }

  return <div className={cn("stat-card", accentClass)}>{content}</div>;
}

export function DataPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("data-panel data-panel-interactive overflow-hidden", className)}>
      <div className="data-panel-header flex items-center justify-between gap-3 border-b border-border/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="data-panel-action shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = ticketStatusTone(status);
  return (
    <span className={cn("status-badge capitalize", statusToneClass[tone])}>
      {label ?? formatTicketStatus(status)}
    </span>
  );
}

export function FormStatusBadge({ status }: { status: FormStatus }) {
  const tone = FORM_STATUS_TONE[status];
  return (
    <span className={cn("status-badge", statusToneClass[tone])}>{FORM_STATUS_LABEL[status]}</span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export function PortalTile({
  to,
  label,
  hint,
  description,
  icon: Icon,
  showPath,
}: {
  to: string;
  label: string;
  hint?: string;
  description?: string;
  icon: LucideIcon;
  showPath?: boolean;
}) {
  return (
    <Link to={to} className="portal-tile group">
      <div className="portal-tile-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {showPath ? (
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground/80">{to}</p>
        ) : null}
      </div>
      <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open →
      </span>
    </Link>
  );
}

export function ActionLink({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      to={to}
      className={cn(
        buttonVariants({ variant: variant === "primary" ? "default" : "outline", size: "sm" }),
        "action-link shadow-sm transition-colors",
      )}
    >
      {children}
    </Link>
  );
}

export function LoadingRows({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-6">
        <div className="max-w-md space-y-2">
          <div className="skeleton-line w-full" />
          <div className="skeleton-line w-4/5 opacity-80" />
          <div className="skeleton-line w-3/5 opacity-60" />
        </div>
      </td>
    </tr>
  );
}

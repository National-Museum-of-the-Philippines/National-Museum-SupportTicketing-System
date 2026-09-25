import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { KeyRound, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";
import { WorkspacePageHeader } from "@/components/layout/workspace-ui";
import {
  SUPER_ADMIN_DASHBOARD,
  SUPER_ADMIN_PERMISSIONS,
  SUPER_ADMIN_ROLES,
  SUPER_ADMIN_USERS,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type RbacSection = "users" | "roles" | "permissions";

const SECTIONS: Array<{ id: RbacSection; label: string; to: string }> = [
  { id: "users", label: "Users", to: SUPER_ADMIN_USERS },
  { id: "roles", label: "Roles", to: SUPER_ADMIN_ROLES },
  { id: "permissions", label: "Permissions", to: SUPER_ADMIN_PERMISSIONS },
];

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  record_management: "Record Management",
  user: "Staff",
};

export function formatRoleLabel(name: string) {
  const key = name.trim().toLowerCase();
  if (ROLE_DISPLAY_LABELS[key]) return ROLE_DISPLAY_LABELS[key];
  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function employeeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function avatarTone(seed: string) {
  const tones = [
    "bg-sky-100 text-sky-800",
    "bg-emerald-100 text-emerald-800",
    "bg-amber-100 text-amber-900",
    "bg-rose-100 text-rose-800",
    "bg-teal-100 text-teal-800",
    "bg-stone-100 text-stone-700",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return tones[hash % tones.length];
}

export function RoleChip({
  name,
  tone = "success",
}: {
  name: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tone === "success" && "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        tone === "warning" && "bg-amber-50 text-amber-800 ring-amber-600/20",
        tone === "default" && "bg-slate-100 text-slate-700 ring-slate-500/15",
      )}
    >
      {formatRoleLabel(name)}
    </span>
  );
}

/** Summary card matching the RBAC reference: icon tile + label + large value. */
export function RbacSummaryCard({
  icon: Icon,
  iconClass,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            iconClass,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground">
            {loading ? "…" : value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RbacShell({
  section,
  title,
  description,
  actions,
  children,
}: {
  section: RbacSection;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-shell">
      <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link to={SUPER_ADMIN_DASHBOARD} className="hover:text-foreground">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span>RBAC</span>
        <span aria-hidden>/</span>
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <WorkspacePageHeader title={title} description={description} actions={actions} />

      <div className="flex gap-1 border-b border-border/80" role="tablist" aria-label="RBAC pages">
        {SECTIONS.map((item) => {
          const active = item.id === section;
          return (
            <Link
              key={item.id}
              to={item.to}
              role="tab"
              aria-selected={active}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-maroon text-maroon"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}

export const RBAC_SECTION_ICONS = { Users, Shield, KeyRound } as const;

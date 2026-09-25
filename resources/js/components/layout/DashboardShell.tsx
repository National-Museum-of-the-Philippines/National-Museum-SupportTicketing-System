import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NmpLogo } from "@/components/layout/NmpLogo";
import { PageTransition } from "@/components/layout/PageTransition";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/lib/auth";
import type { NotificationItem } from "@/lib/notifications";
import {
  ADMIN_DASHBOARD,
  CLIENT_DASHBOARD,
  isSuperAdminRole,
  LOGIN,
  RECORDS_DASHBOARD,
  settingsPathForSlot,
} from "@/lib/navigation";
import { pathToSlot } from "@/lib/sessions";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; badge?: number; icon?: LucideIcon };

export type NavSection = {
  title?: string;
  items: NavItem[];
};

type DashboardShellProps = {
  portalTitle: string;
  /** Flat list — rendered as one section (client / records). */
  nav?: NavItem[];
  /** Grouped sections with optional collapsible headers (admin). */
  navSections?: NavSection[];
  notifications?: NotificationItem[];
  notificationsLoading?: boolean;
  notificationsViewAllTo?: string;
  notificationsEmptyMessage?: string;
  children: ReactNode;
};

function userInitials(name?: string, email?: string) {
  const source = name ?? email ?? "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function sectionKey(section: NavSection, index: number) {
  return section.title ?? `section-${index}`;
}

function itemIsActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function findActiveLabel(pathname: string, sections: NavSection[], fallback: string) {
  let best: { label: string; len: number } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (!itemIsActive(pathname, item.to)) continue;
      if (!best || item.to.length > best.len) {
        best = { label: item.label, len: item.to.length };
      }
    }
  }
  return best?.label ?? fallback;
}

export function DashboardShell({
  portalTitle,
  nav,
  navSections,
  notifications = [],
  notificationsLoading,
  notificationsViewAllTo,
  notificationsEmptyMessage,
  children,
}: DashboardShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSlot = pathToSlot(pathname);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const profileRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(
    () => navSections ?? (nav ? [{ items: nav }] : []),
    [nav, navSections],
  );

  const pageTitle = useMemo(() => {
    if (pathname.includes("/settings")) return "Settings";
    return findActiveLabel(pathname, sections, portalTitle);
  }, [pathname, sections, portalTitle]);

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next = { ...prev };
      let changed = false;
      sections.forEach((section, index) => {
        if (!section.title) return;
        const key = sectionKey(section, index);
        const hasActive = section.items.some((item) => itemIsActive(pathname, item.to));
        if (hasActive && next[key] === true) {
          next[key] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pathname, sections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: prev[key] !== true }));
  };

  const isSectionOpen = (key: string, section: NavSection) => {
    if (!section.title) return true;
    return collapsedSections[key] !== true;
  };

  const renderNavItem = (item: NavItem) => {
    const active = itemIsActive(pathname, item.to);
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "group flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
          active
            ? "sidebar-nav-active"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span
              className={cn(
                "sidebar-nav-icon",
                active ? "sidebar-nav-icon-active" : "sidebar-nav-icon-idle",
                !active && "group-hover:bg-muted group-hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <span className="truncate">{item.label}</span>
        </span>
        {item.badge ? (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              active ? "bg-[#7a1f2b]/15 text-[#7a1f2b]" : "bg-[#7a1f2b] text-white",
            )}
          >
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const renderNavSections = () =>
    sections.map((section, index) => {
      const key = sectionKey(section, index);
      const open = isSectionOpen(key, section);
      const title = section.title ?? (index === 0 ? "MAIN" : undefined);
      const hasTitledGroup = Boolean(title) && section.items.length > 0;

      if (!hasTitledGroup) {
        return (
          <div key={key} className="space-y-0.5">
            {section.items.map(renderNavItem)}
          </div>
        );
      }

      return (
        <div key={key} className="sidebar-nav-section">
          <button
            type="button"
            onClick={() => toggleSection(key)}
            className="sidebar-nav-section-toggle"
            aria-expanded={open}
          >
            <span>{title}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", !open && "-rotate-90")}
              aria-hidden
            />
          </button>
          {open ? <div className="sidebar-nav-section-items">{section.items.map(renderNavItem)}</div> : null}
        </div>
      );
    });

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileOpen]);

  const signOut = () => {
    setProfileOpen(false);
    if (!activeSlot) return;
    // Super Admin sessions are seeded on all portals — clear them together.
    if (isSuperAdminRole(user?.role)) {
      logout("admin");
      logout("records");
      logout("client");
    } else {
      logout(activeSlot);
    }
    void navigate({ to: LOGIN, replace: true });
  };

  const portalSwitcher =
    isSuperAdminRole(user?.role) && !pathname.startsWith("/super-admin") ? (
      <div className="sidebar-nav-section">
        <button type="button" className="sidebar-nav-section-toggle" disabled>
          <span>SWITCH PORTAL</span>
        </button>
        <div className="sidebar-nav-section-items space-y-0.5">
          {(
            [
              {
                to: "/super-admin/dashboard",
                label: "Super Admin",
                icon: Shield,
                match: (p: string) => p.startsWith("/super-admin"),
              },
              {
                to: ADMIN_DASHBOARD,
                label: "Admin",
                icon: Building2,
                match: (p: string) => p.startsWith("/admin"),
              },
              {
                to: RECORDS_DASHBOARD,
                label: "Records",
                icon: ClipboardList,
                match: (p: string) => p.startsWith("/records"),
              },
              {
                to: CLIENT_DASHBOARD,
                label: "Staff",
                icon: Users,
                match: (p: string) => p.startsWith("/client"),
              },
            ] as const
          ).map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "sidebar-nav-active"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "sidebar-nav-icon",
                    active ? "sidebar-nav-icon-active" : "sidebar-nav-icon-idle",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    ) : null;

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="workspace-sidebar-brand shrink-0">
        <div className="workspace-sidebar-brand-inner">
          <div className="sidebar-brand-logo-ring">
            <NmpLogo
              size="sm"
              className="brightness-0 invert drop-shadow-[0_4px_14px_rgba(255,255,255,0.18)]"
            />
          </div>
          <div className="sidebar-brand-copy">
            <p className="sidebar-brand-eyebrow">National Museum of the Philippines</p>
            <h2 className="sidebar-brand-title">Support Ticketing System</h2>
          </div>
        </div>
      </div>

      <nav className="workspace-sidebar-nav workspace-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-6 py-4">
        {portalSwitcher}
        {renderNavSections()}
      </nav>

      <div className="sidebar-bottom-actions shrink-0 border-t border-border/70 px-6 py-4">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
            pathname.includes("/settings")
              ? "sidebar-nav-active"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
          onClick={() => {
            const to = pathname.startsWith("/super-admin")
              ? "/super-admin/settings"
              : settingsPathForSlot(activeSlot);
            void navigate({ to });
          }}
        >
          <span
            className={cn(
              "sidebar-nav-icon",
              pathname.includes("/settings") ? "sidebar-nav-icon-active" : "sidebar-nav-icon-idle",
            )}
          >
            <Settings className="h-4 w-4" />
          </span>
          Settings
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-700"
          onClick={signOut}
        >
          <span className="sidebar-nav-icon sidebar-nav-icon-idle">
            <LogOut className="h-4 w-4" />
          </span>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="workspace-app flex h-dvh overflow-hidden bg-[#f7f5f4]">
      <aside className="workspace-sidebar hidden h-dvh w-64 shrink-0 lg:block">
        {sidebar}
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="workspace-sidebar relative h-full w-72 max-w-[85vw] border-r border-border shadow-2xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg bg-card/90 p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="workspace-header z-40 flex shrink-0 items-center justify-between px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="header-icon-btn text-muted-foreground lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell
              items={notifications}
              loading={notificationsLoading}
              viewAllTo={notificationsViewAllTo}
              emptyMessage={notificationsEmptyMessage}
            />
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="profile-trigger flex items-center gap-2 px-2 py-1.5 text-sm"
              >
                <span className="profile-avatar flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-[#7a1f2b]/12">
                  {userInitials(user?.name, user?.email)}
                </span>
                <span className="hidden max-w-36 truncate text-left sm:block">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {user?.name}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">{portalTitle}</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {profileOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border/80 bg-card py-1 shadow-lg">
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="workspace-main workspace-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-6xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}

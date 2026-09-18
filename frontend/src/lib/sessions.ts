import type { ApiUser } from "@/lib/api/types";

/** One login session per portal — they do not overwrite each other. */
export type PortalSlot = "admin" | "records" | "client";

export type PortalSession = {
  token: string;
  user: ApiUser;
};

export const SESSIONS_STORAGE_KEY = "nmp_portal_sessions";
export const AUTH_CHANGED_EVENT = "nmp-auth-changed";

const LEGACY_TOKEN_KEY = "nmp_api_token";
const LEGACY_USER_KEY = "nmp_api_user";

export function roleToSlot(role: string): PortalSlot {
  if (role === "super_admin" || role === "admin") return "admin";
  if (role === "record_management") return "records";
  return "client";
}

export function pathToSlot(pathname: string): PortalSlot | null {
  if (pathname.startsWith("/super-admin")) return "admin";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/records")) return "records";
  if (pathname.startsWith("/client")) return "client";
  return null;
}

type SessionsStore = Partial<Record<PortalSlot, PortalSession>>;

function readStore(): SessionsStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SessionsStore;
  } catch {
    return {};
  }
}

function writeStore(store: SessionsStore) {
  try {
    if (Object.keys(store).length === 0) {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    /* ignore */
  }
}

function migrateLegacySession() {
  if (typeof window === "undefined") return;
  try {
    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
    const legacyUserRaw = localStorage.getItem(LEGACY_USER_KEY);
    if (!legacyToken || !legacyUserRaw) return;

    const user = JSON.parse(legacyUserRaw) as ApiUser;
    if (!user?.role) return;

    const store = readStore();
    const slot = roleToSlot(user.role);
    if (!store[slot]) {
      store[slot] = { token: legacyToken, user };
      writeStore(store);
    }
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    /* ignore */
  }
}

migrateLegacySession();

export function notifySessionChanged(slot?: PortalSlot) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { slot } }));
}

export function getSession(slot: PortalSlot): PortalSession | null {
  const session = readStore()[slot];
  if (!session?.token || !session.user?.id) return null;
  return session;
}

export function setSession(
  slot: PortalSlot,
  session: PortalSession | null,
  options?: { notify?: boolean },
) {
  const store = readStore();
  if (session) {
    store[slot] = session;
  } else {
    delete store[slot];
  }
  writeStore(store);
  // Default notify=true for login/logout. Pass notify:false when refreshing
  // user from /auth/me so AuthProvider sync does not loop forever.
  if (options?.notify !== false) {
    notifySessionChanged(slot);
  }
}

export function listSessions(): Array<{ slot: PortalSlot; user: ApiUser }> {
  const store = readStore();
  const out: Array<{ slot: PortalSlot; user: ApiUser }> = [];
  for (const slot of ["admin", "records", "client"] as PortalSlot[]) {
    const session = store[slot];
    if (session?.user) out.push({ slot, user: session.user });
  }
  return out;
}

export function getTokenForSlot(slot: PortalSlot): string | null {
  return getSession(slot)?.token ?? null;
}

export function getTokenForPath(pathname: string): string | null {
  const slot = pathToSlot(pathname);
  if (!slot) return null;
  return getTokenForSlot(slot);
}

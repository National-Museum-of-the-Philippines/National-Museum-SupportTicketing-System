import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { api, ApiError } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";
import { queryClient } from "@/lib/query-client";
import {
  AUTH_CHANGED_EVENT,
  getSession,
  listSessions,
  notifySessionChanged,
  pathToSlot,
  roleToSlot,
  SESSIONS_STORAGE_KEY,
  setSession,
  type PortalSlot,
} from "@/lib/sessions";

type AuthContextValue = {
  /** User for the portal matching the current URL (null on /login, /, etc.) */
  user: ApiUser | null;
  activeSlot: PortalSlot | null;
  /** Saved logins per portal — admin, records, and client can all stay signed in */
  sessions: Partial<Record<PortalSlot, ApiUser>>;
  sessionReady: boolean;
  isAuthLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<ApiUser | null>;
  logout: (slot?: PortalSlot) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readSessionsMap(): Partial<Record<PortalSlot, ApiUser>> {
  const map: Partial<Record<PortalSlot, ApiUser>> = {};
  for (const { slot, user } of listSessions()) {
    map[slot] = user;
  }
  return map;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSlot = pathToSlot(pathname);

  const [sessions, setSessions] = useState<Partial<Record<PortalSlot, ApiUser>>>(() =>
    readSessionsMap(),
  );
  const [user, setUser] = useState<ApiUser | null>(() =>
    activeSlot ? (getSession(activeSlot)?.user ?? null) : null,
  );
  const [sessionReady, setSessionReady] = useState(() => !activeSlot);
  const [isAuthLoading, setIsAuthLoading] = useState(() => Boolean(activeSlot));
  useEffect(() => {
    let cancelled = false;

    const syncFromLocal = (slot: PortalSlot | null) => {
      const all = readSessionsMap();
      if (!cancelled) setSessions(all);

      if (!slot) {
        if (!cancelled) {
          setUser(null);
          setSessionReady(true);
          setIsAuthLoading(false);
        }
        return;
      }

      const saved = getSession(slot);
      if (!cancelled) {
        setUser(saved?.user ?? null);
        setSessionReady(true);
        setIsAuthLoading(false);
      }
      // Intentionally no background /auth/me — that remounted portals and wiped
      // in-progress forms. Session is trusted until login, logout, or hard refresh.
    };

    const onAuthChanged = () => {
      const slot = pathToSlot(window.location.pathname);
      syncFromLocal(slot);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSIONS_STORAGE_KEY) onAuthChanged();
    };

    syncFromLocal(activeSlot);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [activeSlot]);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    // Send username or email as-is; Laravel authenticates against MySQL `users`
    const loginId = usernameOrEmail.trim();
    try {
      const { token, user: u } = await api.login(loginId, password);
      const slot = roleToSlot(u.role);
      const payload = { token, user: u };

      // Write slots silently, then notify once to avoid N sync storms.
      setSession(slot, payload, { notify: false });
      if (u.role === "super_admin") {
        setSession("admin", payload, { notify: false });
        setSession("records", payload, { notify: false });
        setSession("client", payload, { notify: false });
      } else if (slot !== "client") {
        // Also unlock client portal so PAMANA employees can submit TA forms.
        setSession("client", payload, { notify: false });
      }
      notifySessionChanged(slot);
      // Refresh portal data once after login (not on every session sync).
      void queryClient.invalidateQueries();

      setSessions(readSessionsMap());

      const currentSlot = pathToSlot(window.location.pathname);
      if (
        currentSlot === slot ||
        currentSlot === "client" ||
        (u.role === "super_admin" &&
          (currentSlot === "admin" || currentSlot === "records" || currentSlot === "client"))
      ) {
        setUser(u);
        setSessionReady(true);
        setIsAuthLoading(false);
      }

      return u;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      if (err instanceof ApiError) throw new Error(err.message);
      throw new Error(
        "Cannot reach the API server. Make sure the backend is running (bun run start).",
      );
    }
  }, []);

  const logout = useCallback(
    (slot?: PortalSlot) => {
      const target = slot ?? activeSlot;
      if (!target) return;
      setSession(target, null);
      setSessions(readSessionsMap());
      if (target === activeSlot) {
        setUser(null);
        setSessionReady(true);
        setIsAuthLoading(false);
      }
      void queryClient.invalidateQueries();
    },
    [activeSlot],
  );

  const value = useMemo(
    () => ({
      sessionReady,
      isAuthLoading,
      user,
      activeSlot,
      sessions,
      login,
      logout,
    }),
    [sessionReady, isAuthLoading, user, activeSlot, sessions, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

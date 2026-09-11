import { redirect } from "@tanstack/react-router";
import { dashboardForRole, LOGIN } from "@/lib/navigation";
import { getSession, type PortalSlot } from "@/lib/sessions";

/**
 * Gate portal routes using the saved local session only.
 * Do NOT call /auth/me here — that re-ran on every navigation and felt like
 * an auto-refresh (wiping Form Builder / Submit Request mid-edit).
 * Token validity is checked on the next API action; 401 clears the session.
 */
export async function ensurePortalRole(allowed: (role: string) => boolean, slot: PortalSlot) {
  const saved = getSession(slot);
  if (!saved?.token || !saved.user?.id) {
    throw redirect({ to: LOGIN, replace: true });
  }
  if (!allowed(saved.user.role)) {
    throw redirect({ to: dashboardForRole(saved.user.role), replace: true });
  }
  return saved.user;
}

import { isAdminRole } from "@/lib/navigation";
import { ensurePortalRole } from "@/lib/portal-guard";

/** Form builder and form management — admin only. */
export async function ensureAdminOnly() {
  return ensurePortalRole(isAdminRole, "admin");
}

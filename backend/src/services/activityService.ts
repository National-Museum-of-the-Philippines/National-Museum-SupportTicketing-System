import { ActivityLog } from "../models/ActivityLog.js";
import type { AuthUser } from "../middleware/auth.js";

export async function logActivity(
  actor: AuthUser | null,
  entry: {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    meta?: Record<string, unknown>;
  },
) {
  return ActivityLog.create({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "System",
    ...entry,
  });
}

export async function listRecentActivities(limit = 20) {
  return ActivityLog.find({}, { sort: { createdAt: -1 }, limit });
}

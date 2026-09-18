import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAssignedPersonnel(
  assignedTo?: Array<{ name: string; division?: string }>,
  emptyLabel = "Not assigned yet",
) {
  if (!assignedTo?.length) return emptyLabel;
  return assignedTo
    .map((person) => (person.division ? `${person.name} (${person.division})` : person.name))
    .join(", ");
}

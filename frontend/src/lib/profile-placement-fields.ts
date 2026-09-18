export type ProfilePlacementField = {
  variable: string;
  label: string;
  hint: string;
};

/** Always available in Print Template → Fields to place (auto-filled from requester). */
export const DEFAULT_PROFILE_PLACEMENT_FIELDS: ProfilePlacementField[] = [
  { variable: "{{prof_division}}", label: "Division/Section", hint: "PAMANA staffinformation.section_id (auto-filled)" },
  { variable: "{{prof_first}}", label: "First Name", hint: "PAMANA staffinformation.first_name (auto-filled)" },
  { variable: "{{prof_middle}}", label: "Middle Name", hint: "PAMANA staffinformation.middle_name (auto-filled)" },
  { variable: "{{prof_last}}", label: "Last Name", hint: "PAMANA staffinformation.last_name (auto-filled)" },
  { variable: "{{prof_email}}", label: "Email Address", hint: "PAMANA staffs.secondary_email ?? email (auto-filled)" },
  { variable: "{{prof_designation}}", label: "Designation", hint: "PAMANA staffinformation.position (auto-filled)" },
];

export const PROFILE_PLACEMENT_VARIABLES = new Set(
  DEFAULT_PROFILE_PLACEMENT_FIELDS.map((field) => field.variable),
);

export type RequesterProfile = {
  name?: string;
  email?: string;
  division?: string;
  firstName?: string;
  middleName?: string;
  middleInitial?: string;
  lastName?: string;
  designation?: string;
};

export function parseDisplayName(name: string): {
  firstName: string;
  middleInitial: string;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleInitial: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleInitial: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleInitial: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleInitial: parts[1].replace(/\./g, "").slice(0, 1),
    lastName: parts.slice(2).join(" "),
  };
}

export function buildRequesterProfileAnswerValues(
  profile: RequesterProfile,
): Record<string, string> {
  // Explicit PAMANA parts only — never invent name parts from display name.
  const firstName = (profile.firstName ?? "").trim();
  const middleName = (profile.middleName ?? profile.middleInitial ?? "").trim();
  const lastName = (profile.lastName ?? "").trim();

  return {
    "{{prof_division}}": (profile.division ?? "").trim(),
    "{{prof_first}}": firstName,
    "{{prof_middle}}": middleName,
    "{{prof_last}}": lastName,
    "{{prof_email}}": (profile.email ?? "").trim(),
    "{{prof_designation}}": (profile.designation ?? "").trim(),
  };
}

export function mergeRequesterProfileIntoAnswers(
  profile: RequesterProfile,
  answers: Record<string, unknown> = {},
): Record<string, unknown> {
  // Profile (PAMANA) wins over any client-supplied prof_* keys.
  return {
    ...answers,
    ...buildRequesterProfileAnswerValues(profile),
  };
}

export function getMissingProfilePlacements(
  placements: Array<{ variable: string }>,
): ProfilePlacementField[] {
  const placed = new Set(placements.map((p) => p.variable));
  return DEFAULT_PROFILE_PLACEMENT_FIELDS.filter((field) => !placed.has(field.variable));
}

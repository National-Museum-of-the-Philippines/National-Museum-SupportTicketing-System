export const PROFILE_PLACEMENT_VARIABLES = new Set([
  "{{prof_division}}",
  "{{prof_first}}",
  "{{prof_middle}}",
  "{{prof_last}}",
  "{{prof_email}}",
  "{{prof_designation}}",
]);

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
  answers: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...answers,
    ...buildRequesterProfileAnswerValues(profile),
  };
}

import type { FormRecord, LiveFormField, TicketRecord } from "@/lib/api/types";
import { formatFieldAnswerValue, isSignatureImageValue } from "@/lib/form-field-values";
import { resolveAnswerForVariable } from "@/lib/placement-values";

export type TicketAnswerRow = {
  label: string;
  value: string;
  type?: string;
  href?: string;
};

export function getTicketForm(ticket: TicketRecord): FormRecord | null {
  return typeof ticket.formId === "object" && ticket.formId !== null ? ticket.formId : null;
}

/** Requestor division for admin lists — prefer ticket.division, else PAMANA form answer. */
export function getTicketDivision(ticket: TicketRecord): string {
  const fromColumn = ticket.division?.trim() ?? "";
  if (fromColumn) return fromColumn;
  const fromAnswers = String(ticket.answers?.["{{prof_division}}"] ?? "").trim();
  return fromAnswers;
}

export function formatTicketFieldValue(field: LiveFormField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const formatted = formatFieldAnswerValue(field, value);
  return formatted || "—";
}

function humanizeVariable(variable: string) {
  const stripped = variable.replace(/^(txt|txa|chk|sig|ddl|dt|file)[_-]?/i, "");
  const words = stripped.replace(/[_-]+/g, " ").trim();
  if (!words) return variable;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function getTicketAnswerRows(ticket: TicketRecord): TicketAnswerRow[] {
  const form = getTicketForm(ticket);
  const answers = ticket.answers ?? {};
  const rows: TicketAnswerRow[] = [];

  if (form?.fields?.length) {
    for (const field of form.fields) {
      const raw = resolveAnswerForVariable(answers, field.variable);
      rows.push({
        label: field.label,
        value: formatTicketFieldValue(field, raw),
        type: field.type,
        href:
          field.type === "signature" && isSignatureImageValue(raw)
            ? raw
            : field.type === "file" && typeof raw === "string" && raw
              ? raw
              : undefined,
      });
    }
  } else {
    for (const [key, value] of Object.entries(answers)) {
      if (key.startsWith("__")) continue;
      rows.push({
        label: humanizeVariable(key),
        value: value === undefined || value === null || value === "" ? "—" : String(value),
      });
    }
  }

  if (ticket.attachmentUrl) {
    rows.push({
      label: "Supporting document",
      value: ticket.attachmentName || "View attachment",
      type: "file",
      href: ticket.attachmentUrl,
    });
  }

  return rows;
}

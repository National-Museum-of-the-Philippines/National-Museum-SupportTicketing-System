import { api } from "@/lib/api/client";
import type { FormDraft, PrintFieldPlacement } from "@/lib/form-builder-store";
import { normalizeFormFields } from "@/lib/form-field-normalize";
import { dataUrlToFile } from "@/lib/upload-data-url";

function buildPlacementBlock(placements: PrintFieldPlacement[], fontSize: number) {
  const lines = placements.map(
    (p) => `${p.variable}\t${p.xPct.toFixed(2)}\t${p.yPct.toFixed(2)}\t${p.label}`,
  );
  return ["[NMP placements]", `fontSize\t${fontSize}`, ...lines, "[/NMP placements]"].join("\n");
}

/** Map local form builder draft to API create/update body (omit huge blobs). */
export function draftToApiBody(draft: FormDraft) {
  const placements = draft.printPlacements ?? [];
  const fontSize = draft.printPlacementFontSize ?? 10;
  const printTemplate =
    placements.length > 0 ? buildPlacementBlock(placements, fontSize) : draft.printTemplate;

  return {
    title: draft.title.trim(),
    refNumber: draft.refNumber,
    effectivity: draft.effectivity,
    version: draft.version,
    department: (draft.department ?? "").trim(),
    requireRecommendingOfficer: Boolean(draft.requireRecommendingOfficer),
    requireImmediateSupervisor: Boolean(draft.requireImmediateSupervisor),
    actionOfficers: (draft.actionOfficers ?? [])
      .filter((o) => o.userId?.trim())
      .map((o) => ({
        userId: o.userId.trim(),
        name: (o.name ?? "").trim(),
        email: (o.email ?? "").trim(),
        division: (o.division ?? "").trim(),
      })),
    actionOfficerCount: Math.max(
      1,
      (draft.actionOfficers ?? []).filter((o) => o.userId?.trim()).length ||
        Math.floor(Number(draft.actionOfficerCount) || 1),
    ),
    fields: normalizeFormFields(draft.fields),
    signatories: draft.signatories,
    printTemplate,
    printPlacements: placements,
    printPlacementFontSize: fontSize,
    printTemplateImagePath: draft.printTemplateImagePath ?? "",
    workProcedureName: draft.workProcedureName ?? "",
    workProcedurePath: draft.workProcedurePath ?? "",
  };
}

/** Upload rendered template image (preferred) then return API body. */
export async function draftToApiBodyWithUploads(draft: FormDraft) {
  const body = draftToApiBody(draft) as Record<string, unknown>;

  // Always prefer the rendered canvas PNG. Form Builder may still hold a raw PDF
  // path from the initial upload; placements are positioned on the stacked image.
  if (draft.printTemplateImage?.startsWith("data:")) {
    const file = await dataUrlToFile(draft.printTemplateImage, `template-${draft.refNumber}.png`);
    const { file: uploaded } = await api.uploadFile(file);
    body.printTemplateImagePath = uploaded.url;
    return body;
  }

  if (draft.printTemplateImagePath?.trim()) {
    body.printTemplateImagePath = draft.printTemplateImagePath.trim();
    return body;
  }

  throw new Error("Upload a form template on the Print Template step before submitting.");
}

import type { FormField } from "@/lib/form-builder-store";
import type { LiveFormField } from "@/lib/api/types";
import { normalizeChoiceFieldOptions } from "@/lib/form-builder/ta-service-types";

type FieldLike = Pick<FormField | LiveFormField, "type" | "options">;

export function normalizeChoiceOptionsForField(field: FieldLike): string[] {
  if (field.type !== "checkbox" && field.type !== "radio" && field.type !== "dropdown") {
    return field.options ?? [];
  }
  return normalizeChoiceFieldOptions(field.options);
}

export function normalizeFormFields<T extends FormField>(fields: T[]): T[] {
  return fields.map((field) => {
    if (field.type !== "checkbox" && field.type !== "radio" && field.type !== "dropdown") {
      return field;
    }
    const options = normalizeChoiceFieldOptions(field.options);
    return options === field.options ? field : { ...field, options };
  });
}

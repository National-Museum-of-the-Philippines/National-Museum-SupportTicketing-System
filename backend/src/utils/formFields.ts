type FormFieldLike = {
  type?: string;
  options?: string[];
  [key: string]: unknown;
};

function parseCommaSeparatedOptions(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeChoiceOptions(options: string[] | undefined): string[] | undefined {
  if (!options?.length) return options;
  if (options.length === 1 && options[0].includes(",")) {
    return parseCommaSeparatedOptions(options[0]);
  }
  return options;
}

/** Normalize field options when reading or saving forms. */
export function normalizeFormFields<T extends FormFieldLike>(fields: T[] | undefined | null): T[] {
  if (!Array.isArray(fields)) return [];

  return fields.map((field) => {
    if (
      field.type === "checkbox" ||
      field.type === "radio" ||
      field.type === "dropdown"
    ) {
      const options = normalizeChoiceOptions(field.options);
      if (options !== field.options) {
        return { ...field, options };
      }
    }
    return field;
  });
}

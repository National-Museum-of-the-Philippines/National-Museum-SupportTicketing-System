import { Loader2, Upload } from "lucide-react";
import { SignaturePad } from "@/components/client/SignaturePad";
import { TimeAmPmPicker } from "@/components/client/TimeAmPmPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LiveFormField } from "@/lib/api/types";
import { normalizeChoiceOptionsForField } from "@/lib/form-field-normalize";
import {
  formatDateTime12h,
  parseDateTimeValue,
  parseTimeTo12h,
} from "@/lib/time-ampm";
import { CLIENT_FILE_FIELD_ACCEPT, MAX_UPLOAD_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

type ClientFieldInputProps = {
  field: LiveFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  onFile?: (file: File) => void;
  uploading?: boolean;
};

export function ClientFieldInput({
  field,
  value,
  onChange,
  onFile,
  uploading = false,
}: ClientFieldInputProps) {
  const id = `field-${field.variable}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-2">
          {label}
          <Textarea
            id={id}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );

    case "dropdown":
      return (
        <div className="space-y-2">
          {label}
          <select
            id={id}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          >
            <option value="">Select…</option>
            {normalizeChoiceOptionsForField(field).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    case "radio":
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </legend>
          <div className="space-y-2">
            {normalizeChoiceOptionsForField(field).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.variable}
                  checked={value === option}
                  onChange={() => onChange(option)}
                  required={field.required}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );

    case "checkbox": {
      const options = normalizeChoiceOptionsForField(field);
      const selected = Array.isArray(value) ? value.map(String) : [];
      const isOthersOption = (option: string) => /^others?$/i.test(option.trim());
      const othersEntry = selected.find((item) => /^others?\s*:/i.test(item));
      const othersText = othersEntry?.replace(/^others?\s*:\s*/i, "") ?? "";
      const isOptionChecked = (option: string) =>
        selected.includes(option) ||
        (isOthersOption(option) &&
          selected.some((item) => isOthersOption(item) || /^others?\s*:/i.test(item)));

      if (options.length === 0) {
        return (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </label>
        );
      }

      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const checked = isOptionChecked(option);
              const showOthersInput = isOthersOption(option) && checked;
              return (
                <div key={option} className={showOthersInput ? "sm:col-span-2" : undefined}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        let next = selected.filter(
                          (item) =>
                            item !== option &&
                            !(isOthersOption(option) && /^others?\s*:/i.test(item)),
                        );
                        if (e.target.checked) {
                          next = [...next, option];
                        }
                        onChange(next);
                      }}
                    />
                    {option}
                  </label>
                  {showOthersInput ? (
                    <Input
                      className="mt-2"
                      value={othersText}
                      placeholder="Please specify"
                      onChange={(e) => {
                        const detail = e.target.value;
                        let next = selected.filter(
                          (item) =>
                            item !== option &&
                            !(isOthersOption(option) && /^others?\s*:/i.test(item)),
                        );
                        // Keep spaces as typed (including while typing the next word).
                        next = [...next, detail.length > 0 ? `Others: ${detail}` : option];
                        onChange(next);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      );
    }

    case "date":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );

    case "time":
      return (
        <div className="space-y-2">
          {label}
          <TimeAmPmPicker
            id={id}
            value={value}
            onChange={(next) => onChange(next)}
            required={field.required}
          />
        </div>
      );

    case "datetime": {
      const { date, time } = parseDateTimeValue(value);
      const emitDateTime = (nextDate: string, nextTimeRaw: string) => {
        if (!nextDate) {
          onChange("");
          return;
        }
        onChange(formatDateTime12h(nextDate, parseTimeTo12h(nextTimeRaw)));
      };
      return (
        <div className="space-y-2">
          {label}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={id}
              type="date"
              className="sm:max-w-[11rem]"
              value={date}
              onChange={(e) =>
                emitDateTime(
                  e.target.value,
                  time && time.hour && time.minute ? `${time.hour}:${time.minute} ${time.ampm}` : "",
                )
              }
              required={field.required}
            />
            <TimeAmPmPicker
              value={time && time.hour && time.minute ? `${time.hour}:${time.minute} ${time.ampm}` : ""}
              onChange={(next) => emitDateTime(date, next)}
              required={field.required}
            />
          </div>
        </div>
      );
    }

    case "email":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="email"
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );

    case "number": {
      const integerOnly = (field.numberMode ?? "integer") === "integer";
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="text"
            inputMode={integerOnly ? "numeric" : "decimal"}
            pattern={integerOnly ? "[0-9]*" : "[0-9]*[.]?[0-9]*"}
            value={String(value ?? "")}
            placeholder={field.placeholder ?? (integerOnly ? "e.g. 10" : "e.g. 10.5")}
            onChange={(e) => {
              const raw = e.target.value;
              // Block scientific notation (e/E) and signs.
              if (/[eE+\-]/.test(raw)) return;
              if (integerOnly) {
                if (raw === "" || /^\d+$/.test(raw)) onChange(raw);
                return;
              }
              if (raw === "" || /^\d*\.?\d*$/.test(raw)) onChange(raw);
            }}
            onKeyDown={(e) => {
              if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                e.preventDefault();
              }
            }}
            required={field.required}
          />
        </div>
      );
    }

    case "signature":
      return (
        <div className="space-y-2">
          {label}
          <SignaturePad
            value={typeof value === "string" ? value : null}
            onChange={(dataUrl) => onChange(dataUrl)}
          />
        </div>
      );

    case "file":
      return (
        <div className="space-y-2">
          {label}
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">
              {uploading
                ? "Uploading…"
                : typeof value === "string" && value
                  ? "File uploaded"
                  : "Choose file"}
            </span>
            <input
              type="file"
              accept={CLIENT_FILE_FIELD_ACCEPT}
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onFile) void onFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {typeof value === "string" && value ? (
            <p className="text-xs text-green-700">✓ File ready to submit</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              PDF only · max {MAX_UPLOAD_MB} MB
            </p>
          )}
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );
  }
}

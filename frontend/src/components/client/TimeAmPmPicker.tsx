import { useEffect, useState } from "react";
import {
  TIME_AMPM_OPTIONS,
  TIME_HOUR_OPTIONS,
  TIME_MINUTE_OPTIONS,
  emptyTimeParts,
  formatTime12h,
  parseTimeTo12h,
  type AmPm,
  type TimeParts12,
} from "@/lib/time-ampm";
import { cn } from "@/lib/utils";

const selectCls =
  "flex h-10 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20";

type TimeAmPmPickerProps = {
  id?: string;
  value: unknown;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
};

export function TimeAmPmPicker({ id, value, onChange, required, className }: TimeAmPmPickerProps) {
  const [parts, setParts] = useState<TimeParts12>(() => parseTimeTo12h(value) ?? emptyTimeParts());

  useEffect(() => {
    const parsed = parseTimeTo12h(value);
    if (parsed) {
      setParts(parsed);
      return;
    }
    if (!String(value ?? "").trim()) {
      setParts((prev) =>
        !prev.hour && !prev.minute ? emptyTimeParts() : prev,
      );
    }
  }, [value]);

  const emit = (next: TimeParts12) => {
    setParts(next);
    if (!next.hour || !next.minute) {
      onChange("");
      return;
    }
    onChange(formatTime12h(next));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <select
        id={id}
        className={cn(selectCls, "min-w-[4.5rem]")}
        value={parts.hour}
        required={required}
        aria-label="Hour"
        onChange={(e) => emit({ ...parts, hour: e.target.value })}
      >
        <option value="">Hour</option>
        {TIME_HOUR_OPTIONS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground" aria-hidden>
        :
      </span>
      <select
        className={cn(selectCls, "min-w-[4.5rem]")}
        value={parts.minute}
        required={required}
        aria-label="Minute"
        onChange={(e) => emit({ ...parts, minute: e.target.value })}
      >
        <option value="">Min</option>
        {TIME_MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        className={cn(selectCls, "min-w-[4.5rem] font-medium")}
        value={parts.ampm}
        aria-label="AM or PM"
        onChange={(e) => emit({ ...parts, ampm: e.target.value as AmPm })}
      >
        {TIME_AMPM_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}

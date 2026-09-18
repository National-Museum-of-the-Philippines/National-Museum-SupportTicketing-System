import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { inputCls } from "./shared";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function fromDateOnlyString(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type EffectivityDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function EffectivityDatePicker({ value, onChange }: EffectivityDatePickerProps) {
  const selected = fromDateOnlyString(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? new Date().getMonth());

  useEffect(() => {
    if (!open || !value) return;
    const d = fromDateOnlyString(value);
    if (!d) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [open, value]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 17 }, (_, i) => current - 5 + i);
  }, []);

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const items: Array<{ day: number; date: Date } | null> = [];

    for (let i = 0; i < firstDay; i++) items.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      items.push({ day, date: new Date(viewYear, viewMonth, day) });
    }
    return items;
  }, [viewMonth, viewYear]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const pickDate = (date: Date) => {
    onChange(toDateOnlyString(date));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            inputCls,
            "flex w-full items-center justify-between text-left",
            !value && "text-muted-foreground",
          )}
        >
          <span>
            {selected
              ? selected.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Select date"}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[min(100vw-2rem,20rem)] border-border/80 p-3 shadow-lg"
        align="start"
        sideOffset={8}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-1.5">
            <select
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="h-8 w-[5.5rem] rounded-md border border-input bg-background px-2 text-sm"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) =>
            cell ? (
              <button
                key={`${cell.date.toISOString()}-${index}`}
                type="button"
                onClick={() => pickDate(cell.date)}
                className={cn(
                  "h-9 rounded-md text-sm transition-colors hover:bg-muted",
                  selected && sameDay(cell.date, selected)
                    ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    : "text-foreground",
                )}
              >
                {cell.day}
              </button>
            ) : (
              <div key={`empty-${index}`} className="h-9" />
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

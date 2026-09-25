import {
  Type,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  CircleDot,
  Calendar as CalendarIcon,
  CalendarClock,
  Clock,
  Upload,
  Mail,
  Hash,
  PenLine,
} from "lucide-react";
import type { FieldType } from "@/lib/form-builder-store";

export const FORM_BUILDER_STEPS = [
  { key: "general", label: "General" },
  { key: "fields", label: "Fields" },
  { key: "print", label: "Print Template" },
  { key: "clientApproval", label: "Client Request Approval" },
  { key: "processOwner", label: "Workflow" },
  { key: "procedure", label: "Supporting Doc" },
] as const;

export type FormBuilderStepKey = (typeof FORM_BUILDER_STEPS)[number]["key"];

export const FIELD_ELEMENTS: { type: FieldType; label: string; icon: React.ElementType }[] = [
  { type: "textbox", label: "Textbox", icon: Type },
  { type: "textarea", label: "Textarea", icon: AlignLeft },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "radio", label: "Radio", icon: CircleDot },
  { type: "date", label: "Date Picker", icon: CalendarIcon },
  { type: "time", label: "Time Picker", icon: Clock },
  { type: "datetime", label: "Date & Time", icon: CalendarClock },
  { type: "file", label: "File Upload", icon: Upload },
  { type: "email", label: "Email", icon: Mail },
  { type: "number", label: "Number", icon: Hash },
  { type: "signature", label: "Signature", icon: PenLine },
];

export const WIZARD_INPUT_CLASS =
  "w-full rounded-lg border border-input/90 bg-background/95 px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-maroon focus:ring-2 focus:ring-maroon/20";

import { WIZARD_INPUT_CLASS } from "@/lib/form-builder/constants";

export { WIZARD_INPUT_CLASS as inputCls };

export function WizardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`wizard-card p-7 sm:p-8 ${className}`}>{children}</div>;
}

export function WizardField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-border/70 pb-5">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {subtitle ? (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

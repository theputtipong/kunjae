import { useId, type ReactNode } from "react";

export type ButtonProps = {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly type?: "button" | "submit";
  readonly variant?: "primary" | "ghost" | "danger";
  readonly disabled?: boolean;
};

export const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
}: ButtonProps) => {
  const styles = {
    primary: "bg-brand-400 text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500",
    ghost: "bg-white text-stone-700 border border-stone-300 hover:bg-stone-50",
    danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
  } as const;

  return (
    <button
      type={type === "submit" ? "submit" : "button"}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  );
};

export type FieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: "text" | "password" | "email";
  readonly placeholder?: string;
  readonly hint?: string;
  readonly sensitive?: boolean;
  readonly autoFocus?: boolean;
};

export const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  sensitive = false,
  autoFocus = false,
}: FieldProps) => {
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const ignoredByPasswordManagers = sensitive || type === "password";

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hint === undefined ? undefined : hintId}
        type={type}
        value={value}
        onChange={(event) => { onChange(event.target.value); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={type === "password" ? "one-time-code" : ignoredByPasswordManagers ? "off" : undefined}
        data-1p-ignore={ignoredByPasswordManagers ? "" : undefined}
        data-lpignore={ignoredByPasswordManagers ? "true" : undefined}
        data-bwignore={ignoredByPasswordManagers ? "" : undefined}
        data-form-type={ignoredByPasswordManagers ? "other" : undefined}
        spellCheck={sensitive ? false : undefined}
        translate={sensitive ? "no" : undefined}
        autoCapitalize={sensitive ? "off" : undefined}
        autoCorrect={sensitive ? "off" : undefined}
        className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-400/40"
      />
      {hint !== undefined && (
        <span id={hintId} className="block text-xs text-stone-500">
          {hint}
        </span>
      )}
    </div>
  );
};

export type CalloutProps = {
  readonly tone: "info" | "warning" | "danger" | "success";
  readonly children: ReactNode;
};

export const Callout = ({ tone, children }: CalloutProps) => {
  const styles = {
    info: "border-stone-200 bg-stone-50 text-stone-700",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-red-300 bg-red-50 text-red-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  } as const;

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
};

export const Card = ({ children }: { readonly children: ReactNode }) => (
  <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">{children}</div>
);

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a form control with a `<label>` that is automatically linked to
 * the first child element via a generated `id` (React 18+ `useId`).
 *
 * If the child already carries an `id`, that value is reused instead.
 * An explicit `htmlFor` prop takes priority over auto-generation.
 */
export function FormField({ label, htmlFor, children, className }: FormFieldProps) {
  const autoId = useId();

  // Determine the effective id: explicit htmlFor → child's own id → auto-generated.
  let effectiveId = htmlFor ?? autoId;
  let enhancedChildren = children;

  if (!htmlFor && isValidElement(children)) {
    const child = children as ReactElement<{ id?: string }>;
    if (child.props.id) {
      effectiveId = child.props.id;
    } else {
      enhancedChildren = cloneElement(child, { id: effectiveId });
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={effectiveId} className="text-sm font-medium text-[var(--color-muted)]">
        {label}
      </label>
      {enhancedChildren}
    </div>
  );
}

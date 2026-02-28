/**
 * Shared base class string for form controls (Input, Select, Textarea).
 *
 * Height is intentionally omitted so that Textarea can set its own sizing.
 * Input and Select prepend `h-10` when composing their final class list.
 */
export const FORM_CONTROL_BASE =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]";

/** Full class for fixed-height controls (Input, Select). */
export const FORM_CONTROL_CLASS = `h-10 ${FORM_CONTROL_BASE}`;

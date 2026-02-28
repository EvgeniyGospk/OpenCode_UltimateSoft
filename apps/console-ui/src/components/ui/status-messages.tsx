interface StatusMessagesProps {
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
  isEmpty?: boolean;
  emptyText?: string;
  loadingText?: string;
}

export function StatusMessages({
  loading,
  error,
  warning,
  isEmpty,
  emptyText = "No items found.",
  loadingText = "Loading..."
}: StatusMessagesProps) {
  return (
    <>
      {loading ? <p role="status" aria-live="polite" className="text-sm text-[var(--color-muted)]">{loadingText}</p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {warning ? <p role="alert" className="text-sm text-[var(--color-warning)]">{warning}</p> : null}
      {!loading && isEmpty ? <p className="text-sm text-[var(--color-muted)]">{emptyText}</p> : null}
    </>
  );
}

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This route is not configured in the current console shell.
        </p>
        <Button asChild variant="primary" className="mt-6">
          <Link to="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

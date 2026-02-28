import { Play } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PlaceholderPanel } from "@/components/layout/placeholder-panel";
import { Button } from "@/components/ui/button";

export function JobsPage() {
  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Run and inspect smoke tasks from the console."
        actions={
          <Button variant="primary" size="sm">
            <Play className="mr-2 h-4 w-4" />
            Run smoke job
          </Button>
        }
      />

      <PlaceholderPanel
        title="Job queue scaffold"
        body="Stage 4 will attach queue-backed execution, live status, logs, cancel, and retry controls."
      />
    </div>
  );
}

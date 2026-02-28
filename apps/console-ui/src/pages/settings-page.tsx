import { Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PlaceholderPanel } from "@/components/layout/placeholder-panel";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Plugin, import/export, and runtime controls."
        actions={
          <Button variant="secondary" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import profile
          </Button>
        }
      />

      <PlaceholderPanel
        title="Plugin settings scaffold"
        body="Stage 5 will render local plugin list and lifecycle actions."
      />

      <PlaceholderPanel
        title="Import/export scaffold"
        body="Stage 6 will wire package export/import flows for profile portability."
      />
    </div>
  );
}

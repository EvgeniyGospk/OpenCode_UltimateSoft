import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentSyncStatus } from "./agents-reducer";

interface SyncStatusCardProps {
  syncStatus: AgentSyncStatus | null;
}

export function SyncStatusCard({ syncStatus }: SyncStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registry Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {syncStatus ? (
          <>
            <p>
              <span className="font-medium">State:</span>{" "}
              {syncStatus.inSync ? "In sync" : "Drift detected"}
            </p>
            <p>
              <span className="font-medium">Registry file:</span>{" "}
              {syncStatus.registryExists ? "Present" : "Missing"}
            </p>
            {syncStatus.issues.length > 0 ? (
              <p className="text-[var(--color-danger)]">
                {syncStatus.issues.join("; ")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[var(--color-muted)]">
            Sync status not loaded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

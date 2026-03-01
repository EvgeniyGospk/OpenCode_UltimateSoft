import { useCallback, useEffect, useMemo, useState } from "react";
import type { BackupsEnvelope } from "@opencode-console/api-client-generated";
import { RefreshCw, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessages } from "@/components/ui/status-messages";
import { apiClient } from "@/lib/api-client";
import { useAsync } from "@/lib/useAsync";

type SnapshotItem = BackupsEnvelope["data"]["items"][number];

export function BackupsPage() {
  const [items, setItems] = useState<SnapshotItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { loading, error, run } = useAsync();

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      ),
    [items]
  );

  const loadBackups = useCallback(async () => {
    await run(async () => {
      const response = await apiClient.listBackups();
      setItems(response.data.items);
    });
  }, [run]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function restoreSnapshot(snapshotId: string) {
    if (!window.confirm(`Restore snapshot '${snapshotId}'?`)) {
      return;
    }

    try {
      setBusyId(snapshotId);

      await run(async () => {
        await apiClient.restoreBackup(snapshotId);
        await loadBackups();
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Backups"
        description="Manage restore points created from profile writes."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadBackups()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Snapshots ({sortedItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusMessages
            loading={loading}
            error={error}
            isEmpty={!loading && items.length === 0}
            emptyText="No snapshots found yet."
            loadingText="Loading snapshots..."
            hasData={items.length > 0}
          />

          {sortedItems.map((snapshot) => (
            <div
              key={snapshot.id}
              className="space-y-2 rounded-lg border border-[var(--color-line)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="truncate">
                    <span className="font-medium">ID:</span> {snapshot.id}
                  </p>
                  <p>
                    <span className="font-medium">Reason:</span>{" "}
                    {snapshot.reason}
                  </p>
                  <p>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(snapshot.createdAt).toLocaleString()}
                  </p>
                  <p className="break-all">
                    <span className="font-medium">Files:</span>{" "}
                    {snapshot.relativePaths.join(", ")}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => void restoreSnapshot(snapshot.id)}
                  className="shrink-0"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

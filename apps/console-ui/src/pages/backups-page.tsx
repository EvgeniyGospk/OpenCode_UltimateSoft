import { useEffect, useMemo, useState } from "react";
import type { BackupsEnvelope } from "@opencode-console/api-client-generated";
import { RefreshCw, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useAsync } from "@/lib/useAsync";

type SnapshotItem = BackupsEnvelope["data"]["items"][number];

export function BackupsPage() {
  const [items, setItems] = useState<SnapshotItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { loading, error, setError, run } = useAsync();

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      ),
    [items]
  );

  async function loadBackups() {
    await run(async () => {
      const response = await apiClient.listBackups();
      setItems(response.data.items);
    });
  }

  useEffect(() => {
    void loadBackups();
  }, []);

  async function restoreSnapshot(snapshotId: string) {
    if (!window.confirm(`Restore snapshot '${snapshotId}'?`)) {
      return;
    }

    setBusyId(snapshotId);

    await run(async () => {
      await apiClient.restoreBackup(snapshotId);
      await loadBackups();
    });

    setBusyId(null);
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
          {loading ? (
            <p className="text-sm text-[var(--color-muted)]">
              Loading snapshots...
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {!loading && sortedItems.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No snapshots found yet.
            </p>
          ) : null}

          {sortedItems.map((snapshot) => (
            <div
              key={snapshot.id}
              className="grid gap-2 rounded-lg border border-[var(--color-line)] p-3 md:grid-cols-[1fr_auto]"
            >
              <div className="space-y-1 text-sm">
                <p>
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
                <p>
                  <span className="font-medium">Files:</span>{" "}
                  {snapshot.relativePaths.join(", ")}
                </p>
              </div>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => void restoreSnapshot(snapshot.id)}
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

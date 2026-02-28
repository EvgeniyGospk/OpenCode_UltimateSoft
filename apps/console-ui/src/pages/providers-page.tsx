import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshCw, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessages } from "@/components/ui/status-messages";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { isJsonObject } from "@/lib/guards";
import { toProviderItemsFromConfig, toDraftMap } from "@/lib/providers-domain";
import type { ProviderItem } from "@/lib/agents-domain";
import { useAsync } from "@/lib/useAsync";

export function ProvidersPage() {
  const [items, setItems] = useState<ProviderItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { loading, error, warning, setError, setWarning, run } = useAsync();

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.key.localeCompare(right.key)),
    [items]
  );

  const loadProviders = useCallback(async () => {
    setWarning(null);

    await run(async () => {
      const response = await apiClient.listProviders();
      setItems(response.data.items);
      setDrafts(toDraftMap(response.data.items));
    });
  }, [run, setWarning]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  async function saveProvider(provider: ProviderItem) {
    const draft = drafts[provider.key];

    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError(`Invalid JSON for provider '${provider.key}'.`);
      return;
    }

    if (!isJsonObject(parsed)) {
      setError(`Provider '${provider.key}' JSON must be an object.`);
      return;
    }
    const definition = parsed;

    try {
      setBusyKey(provider.key);
      setWarning(null);

      await run(async () => {
        const response = await apiClient.updateProvider(provider.key, {
          definition
        });

        const nextProviders = toProviderItemsFromConfig(
          response.data.profile.opencodeJson.provider
        );

        if (nextProviders.length > 0) {
          setItems(nextProviders);
          setDrafts(toDraftMap(nextProviders));
        } else {
          await loadProviders();
        }
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Review and manage provider-level configuration."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadProviders()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Provider Configs ({sortedItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusMessages
            loading={loading}
            error={error}
            warning={warning}
            isEmpty={!loading && sortedItems.length === 0}
            emptyText="No providers found."
            loadingText="Loading providers..."
          />

          {sortedItems.map((provider) => (
            <div
              key={provider.key}
              className="space-y-2 rounded-lg border border-[var(--color-line)] p-3"
            >
              <p className="text-sm font-medium">{provider.key}</p>
              <Textarea
                value={drafts[provider.key] ?? "{}"}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [provider.key]: event.target.value
                  }))
                }
                rows={10}
                className="text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busyKey !== null}
                onClick={() => void saveProvider(provider)}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

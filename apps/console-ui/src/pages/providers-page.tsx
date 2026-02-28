import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProvidersEnvelope } from "@opencode-console/api-client-generated";
import { RefreshCw, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { isJsonObject } from "@/lib/guards";
import { useAsync } from "@/lib/useAsync";

type ProviderItem = ProvidersEnvelope["data"]["items"][number];

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toProviderItemsFromConfig(value: unknown): ProviderItem[] {
  if (!isJsonObject(value)) {
    return [];
  }

  const items: ProviderItem[] = [];

  for (const [key, definition] of Object.entries(value)) {
    if (!isJsonObject(definition)) {
      continue;
    }

    items.push({
      key,
      definition
    });
  }

  return items;
}

function toDraftMap(items: ProviderItem[]): Record<string, string> {
  const nextDrafts: Record<string, string> = {};

  for (const item of items) {
    nextDrafts[item.key] = formatJson(item.definition);
  }

  return nextDrafts;
}

export function ProvidersPage() {
  const [items, setItems] = useState<ProviderItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const hasItemsRef = useRef(false);
  const { loading, error, warning, setError, setWarning, run } = useAsync();

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.key.localeCompare(right.key)),
    [items]
  );

  useEffect(() => {
    hasItemsRef.current = items.length > 0;
  }, [items.length]);

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

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError(`Provider '${provider.key}' JSON must be an object.`);
      return;
    }
    const definition = parsed as Record<string, unknown>;

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

    setBusyKey(null);
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
          {loading ? (
            <p className="text-sm text-[var(--color-muted)]">
              Loading providers...
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {warning ? (
            <p className="text-sm text-amber-700">{warning}</p>
          ) : null}
          {!loading && sortedItems.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No providers found.
            </p>
          ) : null}

          {sortedItems.map((provider) => (
            <div
              key={provider.key}
              className="space-y-2 rounded-lg border border-[var(--color-line)] p-3"
            >
              <p className="text-sm font-medium">{provider.key}</p>
              <textarea
                value={drafts[provider.key] ?? "{}"}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [provider.key]: event.target.value
                  }))
                }
                rows={10}
                className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 font-mono text-xs"
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

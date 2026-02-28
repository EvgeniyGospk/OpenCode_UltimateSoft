import { useCallback, useEffect, useMemo, useReducer } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusMessages } from "@/components/ui/status-messages";
import { apiClient } from "@/lib/api-client";
import { useAsync } from "@/lib/useAsync";
import {
  type ModelVariantMap,
  type SortMode,
  buildModelCatalog,
  extractAvailableModels,
  extractModelVariantMap,
  parseModelRef,
  sortAgents,
} from "@/lib/agents-domain";
import { AgentRow } from "@/components/agents/agent-row";
import { CreateAgentForm } from "@/components/agents/create-agent-form";
import { SyncStatusCard } from "@/components/agents/sync-status-card";
import { agentsReducer, initialAgentsState } from "@/components/agents/agents-reducer";
import { useAgentCrud } from "@/components/agents/use-agent-crud";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentsPage() {
  const [state, dispatch] = useReducer(agentsReducer, initialAgentsState);
  const { loading, error, warning, setError, setWarning, run } = useAsync();

  const modelCatalog = useMemo(
    () => buildModelCatalog(state.availableModels),
    [state.availableModels],
  );

  const parsedNewModel = parseModelRef(state.newModel);
  const selectedModelId =
    parsedNewModel.prefix === state.newModelPrefix
      ? parsedNewModel.modelId
      : "";

  const sortedItems = useMemo(
    () => sortAgents(state.items, state.sortMode),
    [state.items, state.sortMode],
  );

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadAgents = useCallback(async () => {
    setWarning(null);

    await run(async () => {
      const [agentsResponse, syncResponse] = await Promise.all([
        apiClient.listAgents(),
        apiClient.getAgentSyncStatus(),
      ]);

      const baselinePool = extractAvailableModels([], agentsResponse.data.items);
      const baselineCatalog = buildModelCatalog(baselinePool);
      const defaultPrefix = baselineCatalog.prefixes[0] ?? "";

      let finalModels = baselinePool;
      let finalVariantMap: ModelVariantMap = {};
      try {
        const providersResponse = await apiClient.listProviders();
        finalModels = extractAvailableModels(
          providersResponse.data.items,
          agentsResponse.data.items,
        );
        finalVariantMap = extractModelVariantMap(providersResponse.data.items);
      } catch (providerLoadError: unknown) {
        setWarning(
          providerLoadError instanceof Error
            ? `Model pool unavailable: ${providerLoadError.message}`
            : "Model pool unavailable.",
        );
      }

      const finalCatalog = buildModelCatalog(finalModels);

      dispatch({
        type: "HYDRATE_AGENTS",
        items: agentsResponse.data.items,
        syncStatus: syncResponse.data,
        models: finalModels,
        modelVariantMap: finalVariantMap,
        defaultPrefix: finalCatalog.prefixes[0] ?? defaultPrefix,
      });
    });
  }, [run, setWarning]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // -----------------------------------------------------------------------
  // CRUD handlers
  // -----------------------------------------------------------------------

  const { createAgent, saveAgent, deleteAgent, synchronizeRegistry } =
    useAgentCrud({
      state,
      dispatch,
      selectedModelId,
      defaultPrefix: modelCatalog.prefixes[0] ?? "",
      setError,
      run,
      loadAgents,
    });

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Manage local agent definitions and model mappings."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void synchronizeRegistry()}
              disabled={state.busyKey !== null}
            >
              Sync SSOT
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadAgents()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <SyncStatusCard syncStatus={state.syncStatus} />

        <CreateAgentForm
          newKey={state.newKey}
          newModelPrefix={state.newModelPrefix}
          newModel={state.newModel}
          newVariant={state.newVariant}
          newKeyPool={state.newKeyPool}
          modelCatalog={modelCatalog}
          modelVariantMap={state.modelVariantMap}
          dispatch={dispatch}
          busy={state.busyKey !== null}
          onCreate={() => void createAgent()}
        />

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Agent Mappings ({sortedItems.length})</CardTitle>
            <div className="flex flex-col gap-1 text-xs text-[var(--color-muted)] md:flex-row md:items-center md:gap-2">
              <span className="whitespace-nowrap">Sort</span>
              <Select
                value={state.sortMode}
                onChange={(event) =>
                  dispatch({
                    type: "SET_SORT_MODE",
                    value: event.target.value as SortMode,
                  })
                }
                className="h-9 min-w-[220px] text-sm"
              >
                <option value="created-desc">Newest first (creation order)</option>
                <option value="created-asc">Oldest first (creation order)</option>
                <option value="key-asc">Key A-Z</option>
                <option value="key-desc">Key Z-A</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusMessages
              loading={loading}
              error={error}
              warning={warning}
              isEmpty={!loading && state.items.length === 0}
              emptyText="No agents found."
              loadingText="Loading agents..."
              hasData={state.items.length > 0}
            />

            {sortedItems.map((agent) => (
              <AgentRow
                key={agent.key}
                agent={agent}
                availableModels={state.availableModels}
                modelVariantMap={state.modelVariantMap}
                modelDraft={state.modelDrafts[agent.key] ?? ""}
                variantDraft={state.variantDrafts[agent.key] ?? ""}
                keyDraft={state.keyDrafts[agent.key] ?? agent.key}
                keyPoolDraft={state.keyPoolDrafts[agent.key] ?? "any"}
                dispatch={dispatch}
                busy={state.busyKey !== null}
                onSave={saveAgent}
                onDelete={deleteAgent}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

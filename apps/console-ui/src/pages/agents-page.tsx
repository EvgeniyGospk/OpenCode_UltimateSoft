import { useEffect, useMemo, useReducer } from "react";
import type {
  AgentSyncStatusEnvelope
} from "@opencode-console/api-client-generated";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useAsync } from "@/lib/useAsync";
import {
  type AgentItem,
  type AgentKeyPool,
  type ModelVariantMap,
  type SortMode,
  buildModelCatalog,
  composeModelRef,
  extractAvailableModels,
  extractModelVariantMap,
  formatVariantLabel,
  parseModelRef,
  readModel,
  readVariant,
  resolveVariantOptions,
  sortAgents,
  toSelectOptions,
  toVariantOptions
} from "@/lib/agents-domain";

type AgentSyncStatus = AgentSyncStatusEnvelope["data"];

// ---------------------------------------------------------------------------
// Consolidated state via useReducer
// ---------------------------------------------------------------------------

interface AgentsState {
  items: AgentItem[];
  availableModels: string[];
  modelVariantMap: ModelVariantMap;
  syncStatus: AgentSyncStatus | null;
  // "Create" form fields
  newKey: string;
  newModelPrefix: string;
  newModel: string;
  newVariant: string;
  newKeyPool: AgentKeyPool;
  // Per-agent edit drafts
  modelDrafts: Record<string, string>;
  variantDrafts: Record<string, string>;
  keyDrafts: Record<string, string>;
  keyPoolDrafts: Record<string, AgentKeyPool>;
  // UI
  busyKey: string | null;
  sortMode: SortMode;
}

type AgentsAction =
  | { type: "SET_ITEMS"; items: AgentItem[] }
  | { type: "SET_AVAILABLE_MODELS"; models: string[] }
  | { type: "SET_MODEL_VARIANT_MAP"; map: ModelVariantMap }
  | { type: "SET_SYNC_STATUS"; status: AgentSyncStatus | null }
  | { type: "SET_NEW_KEY"; value: string }
  | { type: "SET_NEW_MODEL_PREFIX"; value: string }
  | { type: "SET_NEW_MODEL"; value: string }
  | { type: "SET_NEW_VARIANT"; value: string }
  | { type: "SET_NEW_KEY_POOL"; value: AgentKeyPool }
  | { type: "SET_MODEL_DRAFT"; agentKey: string; value: string }
  | { type: "SET_VARIANT_DRAFT"; agentKey: string; value: string }
  | { type: "SET_KEY_DRAFT"; agentKey: string; value: string }
  | { type: "SET_KEY_POOL_DRAFT"; agentKey: string; value: AgentKeyPool }
  | { type: "SET_BUSY_KEY"; value: string | null }
  | { type: "SET_SORT_MODE"; value: SortMode }
  | { type: "RESET_CREATE_FORM"; defaultPrefix: string }
  | {
      type: "HYDRATE_AGENTS";
      items: AgentItem[];
      syncStatus: AgentSyncStatus;
      models: string[];
      modelVariantMap: ModelVariantMap;
      defaultPrefix: string;
    };

const initialState: AgentsState = {
  items: [],
  availableModels: [],
  modelVariantMap: {},
  syncStatus: null,
  newKey: "",
  newModelPrefix: "",
  newModel: "",
  newVariant: "",
  newKeyPool: "any",
  modelDrafts: {},
  variantDrafts: {},
  keyDrafts: {},
  keyPoolDrafts: {},
  busyKey: null,
  sortMode: "created-desc"
};

function agentsReducer(state: AgentsState, action: AgentsAction): AgentsState {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.items };
    case "SET_AVAILABLE_MODELS":
      return { ...state, availableModels: action.models };
    case "SET_MODEL_VARIANT_MAP":
      return { ...state, modelVariantMap: action.map };
    case "SET_SYNC_STATUS":
      return { ...state, syncStatus: action.status };
    case "SET_NEW_KEY":
      return { ...state, newKey: action.value };
    case "SET_NEW_MODEL_PREFIX":
      return { ...state, newModelPrefix: action.value };
    case "SET_NEW_MODEL":
      return { ...state, newModel: action.value };
    case "SET_NEW_VARIANT":
      return { ...state, newVariant: action.value };
    case "SET_NEW_KEY_POOL":
      return { ...state, newKeyPool: action.value };
    case "SET_MODEL_DRAFT":
      return {
        ...state,
        modelDrafts: { ...state.modelDrafts, [action.agentKey]: action.value }
      };
    case "SET_VARIANT_DRAFT":
      return {
        ...state,
        variantDrafts: {
          ...state.variantDrafts,
          [action.agentKey]: action.value
        }
      };
    case "SET_KEY_DRAFT":
      return {
        ...state,
        keyDrafts: { ...state.keyDrafts, [action.agentKey]: action.value }
      };
    case "SET_KEY_POOL_DRAFT":
      return {
        ...state,
        keyPoolDrafts: {
          ...state.keyPoolDrafts,
          [action.agentKey]: action.value
        }
      };
    case "SET_BUSY_KEY":
      return { ...state, busyKey: action.value };
    case "SET_SORT_MODE":
      return { ...state, sortMode: action.value };
    case "RESET_CREATE_FORM":
      return {
        ...state,
        newKey: "",
        newModel: "",
        newVariant: "",
        newKeyPool: "any",
        newModelPrefix: action.defaultPrefix
      };
    case "HYDRATE_AGENTS": {
      const drafts: Record<string, string> = {};
      const variants: Record<string, string> = {};
      const keys: Record<string, string> = {};
      const pools: Record<string, AgentKeyPool> = {};
      for (const item of action.items) {
        drafts[item.key] = readModel(item.definition);
        variants[item.key] = readVariant(item.definition);
        keys[item.key] = item.key;
        pools[item.key] = item.keyPool;
      }

      // Preserve current create-form model if still valid
      const currentModel = state.newModel.trim();
      const nextModel = action.models.includes(currentModel) ? currentModel : "";
      const nextPrefix = nextModel
        ? parseModelRef(nextModel).prefix
        : action.defaultPrefix;
      const variantOptions = resolveVariantOptions(
        nextModel,
        action.modelVariantMap
      );
      const nextVariant = variantOptions.includes(state.newVariant.trim())
        ? state.newVariant.trim()
        : "";

      return {
        ...state,
        items: action.items,
        syncStatus: action.syncStatus,
        availableModels: action.models,
        modelVariantMap: action.modelVariantMap,
        modelDrafts: drafts,
        variantDrafts: variants,
        keyDrafts: keys,
        keyPoolDrafts: pools,
        newModel: nextModel,
        newModelPrefix: nextPrefix,
        newVariant: nextVariant
      };
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentsPage() {
  const [state, dispatch] = useReducer(agentsReducer, initialState);
  const { loading, error, warning, setError, setWarning, run } = useAsync();

  const modelCatalog = useMemo(
    () => buildModelCatalog(state.availableModels),
    [state.availableModels]
  );
  const createModelIds =
    modelCatalog.modelIdsByPrefix[state.newModelPrefix] ?? [];
  const parsedNewModel = parseModelRef(state.newModel);
  const selectedModelId =
    parsedNewModel.prefix === state.newModelPrefix
      ? parsedNewModel.modelId
      : "";
  const createVariantOptions = toVariantOptions(
    state.newModel,
    state.newVariant,
    state.modelVariantMap
  );

  const sortedItems = useMemo(
    () => sortAgents(state.items, state.sortMode),
    [state.items, state.sortMode]
  );

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  async function loadAgents() {
    setWarning(null);

    await run(async () => {
      const [agentsResponse, syncResponse] = await Promise.all([
        apiClient.listAgents(),
        apiClient.getAgentSyncStatus()
      ]);

      // Baseline (agents-only) pool
      const baselinePool = extractAvailableModels(
        [],
        agentsResponse.data.items
      );
      const baselineCatalog = buildModelCatalog(baselinePool);
      const defaultPrefix = baselineCatalog.prefixes[0] ?? "";

      // Try enriching with provider data (non-fatal)
      let finalModels = baselinePool;
      let finalVariantMap: ModelVariantMap = {};
      try {
        const providersResponse = await apiClient.listProviders();
        finalModels = extractAvailableModels(
          providersResponse.data.items,
          agentsResponse.data.items
        );
        finalVariantMap = extractModelVariantMap(providersResponse.data.items);
      } catch (providerLoadError: unknown) {
        setWarning(
          providerLoadError instanceof Error
            ? `Model pool unavailable: ${providerLoadError.message}`
            : "Model pool unavailable."
        );
      }

      const finalCatalog = buildModelCatalog(finalModels);

      dispatch({
        type: "HYDRATE_AGENTS",
        items: agentsResponse.data.items,
        syncStatus: syncResponse.data,
        models: finalModels,
        modelVariantMap: finalVariantMap,
        defaultPrefix: finalCatalog.prefixes[0] ?? defaultPrefix
      });
    });
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  // -----------------------------------------------------------------------
  // CRUD operations
  // -----------------------------------------------------------------------

  async function createAgent() {
    const trimmedKey = state.newKey.trim();
    if (!trimmedKey) {
      setError("Agent key cannot be empty.");
      return;
    }

    const trimmedModel = composeModelRef(state.newModelPrefix, selectedModelId);
    if (!trimmedModel) {
      setError("Choose a model from available pool.");
      return;
    }
    if (!state.availableModels.includes(trimmedModel)) {
      setError(
        "Selected model is not in available provider pool. Refresh and retry."
      );
      return;
    }

    dispatch({ type: "SET_BUSY_KEY", value: "create" });

    await run(async () => {
      const normalizedVariant = state.newVariant.trim();
      await apiClient.createAgent({
        key: trimmedKey,
        definition: normalizedVariant
          ? { model: trimmedModel, variant: normalizedVariant }
          : { model: trimmedModel },
        keyPool: state.newKeyPool
      });
      dispatch({
        type: "RESET_CREATE_FORM",
        defaultPrefix: modelCatalog.prefixes[0] ?? ""
      });
      await loadAgents();
    });

    dispatch({ type: "SET_BUSY_KEY", value: null });
  }

  async function updateAgent(agent: AgentItem) {
    const modelValue = (state.modelDrafts[agent.key] ?? "").trim();
    const variantValue = (state.variantDrafts[agent.key] ?? "").trim();
    const keyPool = state.keyPoolDrafts[agent.key] ?? "any";

    dispatch({ type: "SET_BUSY_KEY", value: `update:${agent.key}` });

    await run(async () => {
      const nextDefinition = {
        ...agent.definition,
        model: modelValue
      } as Record<string, unknown>;
      if (variantValue) {
        nextDefinition.variant = variantValue;
      } else {
        delete nextDefinition.variant;
      }

      await apiClient.updateAgent(agent.key, {
        definition: nextDefinition,
        keyPool
      });
      await loadAgents();
    });

    dispatch({ type: "SET_BUSY_KEY", value: null });
  }

  async function renameAgent(agent: AgentItem) {
    const nextKey = (state.keyDrafts[agent.key] ?? "").trim();
    if (!nextKey) {
      setError("Agent key cannot be empty.");
      return;
    }
    if (nextKey === agent.key) {
      setError("Agent key is unchanged.");
      return;
    }

    dispatch({ type: "SET_BUSY_KEY", value: `rename:${agent.key}` });

    await run(async () => {
      await apiClient.renameAgent(agent.key, { key: nextKey });
      await loadAgents();
    });

    dispatch({ type: "SET_BUSY_KEY", value: null });
  }

  async function deleteAgent(agent: AgentItem) {
    if (!window.confirm(`Delete agent '${agent.key}'?`)) {
      return;
    }

    dispatch({ type: "SET_BUSY_KEY", value: `delete:${agent.key}` });

    await run(async () => {
      await apiClient.deleteAgent(agent.key);
      await loadAgents();
    });

    dispatch({ type: "SET_BUSY_KEY", value: null });
  }

  async function synchronizeRegistry() {
    dispatch({ type: "SET_BUSY_KEY", value: "sync" });

    await run(async () => {
      await apiClient.synchronizeAgents();
      await loadAgents();
    });

    dispatch({ type: "SET_BUSY_KEY", value: null });
  }

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
        <Card>
          <CardHeader>
            <CardTitle>Registry Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {state.syncStatus ? (
              <>
                <p>
                  <span className="font-medium">State:</span>{" "}
                  {state.syncStatus.inSync ? "In sync" : "Drift detected"}
                </p>
                <p>
                  <span className="font-medium">Registry file:</span>{" "}
                  {state.syncStatus.registryExists ? "Present" : "Missing"}
                </p>
                {state.syncStatus.issues.length > 0 ? (
                  <p className="text-rose-700">
                    {state.syncStatus.issues.join("; ")}
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

        <Card>
          <CardHeader>
            <CardTitle>Create Agent</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_1fr_180px_220px_auto] md:items-end">
            <label className="text-sm">
              <span className="mb-1 block text-[var(--color-muted)]">
                Agent key
              </span>
              <input
                type="text"
                value={state.newKey}
                onChange={(event) =>
                  dispatch({ type: "SET_NEW_KEY", value: event.target.value })
                }
                placeholder="e.g. planner"
                className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-[var(--color-muted)]">
                Model prefix
              </span>
              <select
                value={state.newModelPrefix}
                onChange={(event) => {
                  const nextPrefix = event.target.value;
                  dispatch({ type: "SET_NEW_MODEL_PREFIX", value: nextPrefix });

                  const firstModelId =
                    modelCatalog.modelIdsByPrefix[nextPrefix]?.[0] ?? "";
                  const nextModel = composeModelRef(nextPrefix, firstModelId);
                  dispatch({ type: "SET_NEW_MODEL", value: nextModel });

                  const variantOptions = resolveVariantOptions(
                    nextModel,
                    state.modelVariantMap
                  );
                  const currentVariant = state.newVariant.trim();
                  dispatch({
                    type: "SET_NEW_VARIANT",
                    value: variantOptions.includes(currentVariant)
                      ? currentVariant
                      : ""
                  });
                }}
                className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
              >
                <option value="">Select prefix</option>
                {modelCatalog.prefixes.map((prefix) => (
                  <option key={prefix || "__none"} value={prefix}>
                    {prefix || "(no prefix)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-[var(--color-muted)]">
                Model
              </span>
              <select
                value={selectedModelId}
                onChange={(event) => {
                  const nextModel = composeModelRef(
                    state.newModelPrefix,
                    event.target.value
                  );
                  dispatch({ type: "SET_NEW_MODEL", value: nextModel });

                  const variantOptions = resolveVariantOptions(
                    nextModel,
                    state.modelVariantMap
                  );
                  const currentVariant = state.newVariant.trim();
                  dispatch({
                    type: "SET_NEW_VARIANT",
                    value: variantOptions.includes(currentVariant)
                      ? currentVariant
                      : ""
                  });
                }}
                className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
              >
                <option value="">Select model</option>
                {createModelIds.length === 0 ? (
                  <option value="">No provider models detected</option>
                ) : null}
                {createModelIds.map((modelId) => (
                  <option key={modelId} value={modelId}>
                    {modelId}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-[var(--color-muted)]">
                Reasoning
              </span>
              <select
                value={state.newVariant}
                onChange={(event) =>
                  dispatch({
                    type: "SET_NEW_VARIANT",
                    value: event.target.value
                  })
                }
                className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
              >
                <option value="">Default</option>
                {createVariantOptions.map((variant) => (
                  <option key={variant} value={variant}>
                    {formatVariantLabel(variant)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-[var(--color-muted)]">
                Key pool
              </span>
              <select
                value={state.newKeyPool}
                onChange={(event) =>
                  dispatch({
                    type: "SET_NEW_KEY_POOL",
                    value: event.target.value as AgentKeyPool
                  })
                }
                className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
              >
                <option value="any">Any</option>
                <option value="software">Software (source=opencode)</option>
                <option value="default">Default (source=codex)</option>
              </select>
            </label>

            <Button
              variant="primary"
              size="sm"
              onClick={() => void createAgent()}
              disabled={state.busyKey !== null}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Agent Mappings ({sortedItems.length})</CardTitle>
            <div className="flex flex-col gap-1 text-xs text-[var(--color-muted)] md:flex-row md:items-center md:gap-2">
              <span className="whitespace-nowrap">Sort</span>
              <select
                value={state.sortMode}
                onChange={(event) =>
                  dispatch({
                    type: "SET_SORT_MODE",
                    value: event.target.value as SortMode
                  })
                }
                className="h-9 min-w-[220px] rounded-lg border border-[var(--color-line)] px-3 text-sm text-[var(--color-text)]"
              >
                <option value="created-desc">
                  Newest first (creation order)
                </option>
                <option value="created-asc">
                  Oldest first (creation order)
                </option>
                <option value="key-asc">Key A-Z</option>
                <option value="key-desc">Key Z-A</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-[var(--color-muted)]">
                Loading agents...
              </p>
            ) : null}
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {warning ? (
              <p className="text-sm text-amber-700">{warning}</p>
            ) : null}
            {!loading && sortedItems.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No agents found.
              </p>
            ) : null}

            {sortedItems.map((agent) => (
              <div
                key={agent.key}
                className="grid gap-2 rounded-lg border border-[var(--color-line)] p-3 md:grid-cols-[220px_1fr_180px_220px_auto_auto_auto] md:items-end"
              >
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-muted)]">
                    Agent key
                  </span>
                  <input
                    type="text"
                    value={state.keyDrafts[agent.key] ?? agent.key}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_KEY_DRAFT",
                        agentKey: agent.key,
                        value: event.target.value
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-muted)]">
                    Model
                  </span>
                  <select
                    value={state.modelDrafts[agent.key] ?? ""}
                    onChange={(event) => {
                      const nextModel = event.target.value;
                      dispatch({
                        type: "SET_MODEL_DRAFT",
                        agentKey: agent.key,
                        value: nextModel
                      });

                      const variantOptions = resolveVariantOptions(
                        nextModel,
                        state.modelVariantMap
                      );
                      const currentVariant = (
                        state.variantDrafts[agent.key] ?? ""
                      ).trim();
                      if (
                        currentVariant &&
                        !variantOptions.includes(currentVariant)
                      ) {
                        dispatch({
                          type: "SET_VARIANT_DRAFT",
                          agentKey: agent.key,
                          value: ""
                        });
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
                  >
                    <option value="">Select model</option>
                    {toSelectOptions(
                      state.availableModels,
                      state.modelDrafts[agent.key] ?? ""
                    ).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-muted)]">
                    Reasoning
                  </span>
                  <select
                    value={state.variantDrafts[agent.key] ?? ""}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_VARIANT_DRAFT",
                        agentKey: agent.key,
                        value: event.target.value
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
                  >
                    <option value="">Default</option>
                    {toVariantOptions(
                      state.modelDrafts[agent.key] ??
                        readModel(agent.definition),
                      state.variantDrafts[agent.key] ??
                        readVariant(agent.definition),
                      state.modelVariantMap
                    ).map((variant) => (
                      <option key={variant} value={variant}>
                        {formatVariantLabel(variant)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-muted)]">
                    Key pool
                  </span>
                  <select
                    value={state.keyPoolDrafts[agent.key] ?? "any"}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_KEY_POOL_DRAFT",
                        agentKey: agent.key,
                        value: event.target.value as AgentKeyPool
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--color-line)] px-3"
                  >
                    <option value="any">Any</option>
                    <option value="software">Software (source=opencode)</option>
                    <option value="default">Default (source=codex)</option>
                  </select>
                </label>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={state.busyKey !== null}
                  onClick={() => void renameAgent(agent)}
                >
                  Rename
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={state.busyKey !== null}
                  onClick={() => void updateAgent(agent)}
                >
                  Save
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-700 hover:text-rose-800"
                  disabled={state.busyKey !== null}
                  onClick={() => void deleteAgent(agent)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

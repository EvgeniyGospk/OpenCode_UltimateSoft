import type { AgentSyncStatusEnvelope } from "@opencode-console/api-client-generated";
import type {
  AgentItem,
  AgentKeyPool,
  ModelVariantMap,
  SortMode,
} from "@/lib/agents-domain";
import { parseModelRef, readModel, readVariant, resolveVariantOptions } from "@/lib/agents-domain";

export type AgentSyncStatus = AgentSyncStatusEnvelope["data"];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface AgentsState {
  items: AgentItem[];
  availableModels: string[];
  modelVariantMap: ModelVariantMap;
  syncStatus: AgentSyncStatus | null;
  newKey: string;
  newModelPrefix: string;
  newModel: string;
  newVariant: string;
  newKeyPool: AgentKeyPool;
  modelDrafts: Record<string, string>;
  variantDrafts: Record<string, string>;
  keyDrafts: Record<string, string>;
  keyPoolDrafts: Record<string, AgentKeyPool>;
  busyKey: string | null;
  sortMode: SortMode;
}

export const initialAgentsState: AgentsState = {
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
  sortMode: "created-desc",
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AgentsAction =
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
  | { type: "DELETE_AGENT"; key: string }
  | { type: "RESET_CREATE_FORM"; defaultPrefix: string }
  | {
      type: "HYDRATE_AGENTS";
      items: AgentItem[];
      syncStatus: AgentSyncStatus;
      models: string[];
      modelVariantMap: ModelVariantMap;
      defaultPrefix: string;
    };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function agentsReducer(state: AgentsState, action: AgentsAction): AgentsState {
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
        modelDrafts: { ...state.modelDrafts, [action.agentKey]: action.value },
      };
    case "SET_VARIANT_DRAFT":
      return {
        ...state,
        variantDrafts: {
          ...state.variantDrafts,
          [action.agentKey]: action.value,
        },
      };
    case "SET_KEY_DRAFT":
      return {
        ...state,
        keyDrafts: { ...state.keyDrafts, [action.agentKey]: action.value },
      };
    case "SET_KEY_POOL_DRAFT":
      return {
        ...state,
        keyPoolDrafts: {
          ...state.keyPoolDrafts,
          [action.agentKey]: action.value,
        },
      };
    case "SET_BUSY_KEY":
      return { ...state, busyKey: action.value };
    case "SET_SORT_MODE":
      return { ...state, sortMode: action.value };
    case "DELETE_AGENT": {
      const { [action.key]: _, ...remainingModelDrafts } = state.modelDrafts;
      const { [action.key]: __, ...remainingVariantDrafts } = state.variantDrafts;
      const { [action.key]: ___, ...remainingKeyDrafts } = state.keyDrafts;
      const { [action.key]: ____, ...remainingKeyPoolDrafts } = state.keyPoolDrafts;
      return {
        ...state,
        items: state.items.filter(a => a.key !== action.key),
        modelDrafts: remainingModelDrafts,
        variantDrafts: remainingVariantDrafts,
        keyDrafts: remainingKeyDrafts,
        keyPoolDrafts: remainingKeyPoolDrafts,
      };
    }
    case "RESET_CREATE_FORM":
      return {
        ...state,
        newKey: "",
        newModel: "",
        newVariant: "",
        newKeyPool: "any",
        newModelPrefix: action.defaultPrefix,
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

      const currentModel = state.newModel.trim();
      const nextModel = action.models.includes(currentModel) ? currentModel : "";
      const nextPrefix = nextModel
        ? parseModelRef(nextModel).prefix
        : action.defaultPrefix;
      const variantOptions = resolveVariantOptions(
        nextModel,
        action.modelVariantMap,
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
        newVariant: nextVariant,
      };
    }
    default:
      return state;
  }
}

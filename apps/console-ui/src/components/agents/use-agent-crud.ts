import { useCallback, type Dispatch } from "react";
import type { AgentItem } from "@/lib/agents-domain";
import { composeModelRef } from "@/lib/agents-domain";
import { apiClient } from "@/lib/api-client";
import type { AgentsAction, AgentsState } from "./agents-reducer";

// ---------------------------------------------------------------------------
// Hook params
// ---------------------------------------------------------------------------

interface UseAgentCrudParams {
  state: AgentsState;
  dispatch: Dispatch<AgentsAction>;
  selectedModelId: string;
  defaultPrefix: string;
  setError: (msg: string | null) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  loadAgents: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentCrud({
  state,
  dispatch,
  selectedModelId,
  defaultPrefix,
  setError,
  run,
  loadAgents,
}: UseAgentCrudParams) {
  const createAgent = useCallback(async () => {
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
        "Selected model is not in available provider pool. Refresh and retry.",
      );
      return;
    }

    try {
      dispatch({ type: "SET_BUSY_KEY", value: "create" });

      await run(async () => {
        const normalizedVariant = state.newVariant.trim();
        await apiClient.createAgent({
          key: trimmedKey,
          definition: normalizedVariant
            ? { model: trimmedModel, variant: normalizedVariant }
            : { model: trimmedModel },
          keyPool: state.newKeyPool,
        });
        dispatch({ type: "RESET_CREATE_FORM", defaultPrefix });
        await loadAgents();
      });
    } finally {
      dispatch({ type: "SET_BUSY_KEY", value: null });
    }
  }, [
    state.newKey,
    state.newModelPrefix,
    state.newVariant,
    state.newKeyPool,
    state.availableModels,
    selectedModelId,
    defaultPrefix,
    setError,
    run,
    dispatch,
    loadAgents,
  ]);

  const saveAgent = useCallback(
    async (agent: AgentItem) => {
      const keyDraft = (state.keyDrafts[agent.key] ?? "").trim();
      const modelValue = (state.modelDrafts[agent.key] ?? "").trim();
      const variantValue = (state.variantDrafts[agent.key] ?? "").trim();
      const keyPool = state.keyPoolDrafts[agent.key] ?? "any";

      if (!keyDraft) {
        setError("Agent key cannot be empty.");
        return;
      }

      const needsRename = keyDraft !== agent.key;

      try {
        dispatch({ type: "SET_BUSY_KEY", value: `save:${agent.key}` });

        await run(async () => {
          if (needsRename) {
            await apiClient.renameAgent(agent.key, { key: keyDraft });
          }

          const effectiveKey = needsRename ? keyDraft : agent.key;

          const nextDefinition = {
            ...agent.definition,
            model: modelValue,
          } as Record<string, unknown>;
          if (variantValue) {
            nextDefinition.variant = variantValue;
          } else {
            delete nextDefinition.variant;
          }

          await apiClient.updateAgent(effectiveKey, {
            definition: nextDefinition,
            keyPool,
          });
          await loadAgents();
        });
      } finally {
        dispatch({ type: "SET_BUSY_KEY", value: null });
      }
    },
    [state.keyDrafts, state.modelDrafts, state.variantDrafts, state.keyPoolDrafts, setError, run, dispatch, loadAgents],
  );

  const deleteAgent = useCallback(
    async (agent: AgentItem) => {
      if (!window.confirm(`Delete agent '${agent.key}'?`)) {
        return;
      }

      try {
        dispatch({ type: "SET_BUSY_KEY", value: `delete:${agent.key}` });

        await run(async () => {
          await apiClient.deleteAgent(agent.key);
          await loadAgents();
        });
      } finally {
        dispatch({ type: "SET_BUSY_KEY", value: null });
      }
    },
    [run, dispatch, loadAgents],
  );

  const synchronizeRegistry = useCallback(async () => {
    try {
      dispatch({ type: "SET_BUSY_KEY", value: "sync" });

      await run(async () => {
        await apiClient.synchronizeAgents();
        await loadAgents();
      });
    } finally {
      dispatch({ type: "SET_BUSY_KEY", value: null });
    }
  }, [run, dispatch, loadAgents]);

  return { createAgent, saveAgent, deleteAgent, synchronizeRegistry };
}

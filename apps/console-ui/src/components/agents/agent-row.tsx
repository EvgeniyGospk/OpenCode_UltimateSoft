import type { Dispatch } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AgentItem, AgentKeyPool, ModelVariantMap } from "@/lib/agents-domain";
import {
  formatVariantLabel,
  readModel,
  readVariant,
  resolveVariantOptions,
  toSelectOptions,
  toVariantOptions,
} from "@/lib/agents-domain";
import { KEY_POOL_OPTIONS } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Actions the agent row dispatches back to the parent reducer. */
export type AgentRowAction =
  | { type: "SET_MODEL_DRAFT"; agentKey: string; value: string }
  | { type: "SET_VARIANT_DRAFT"; agentKey: string; value: string }
  | { type: "SET_KEY_DRAFT"; agentKey: string; value: string }
  | { type: "SET_KEY_POOL_DRAFT"; agentKey: string; value: AgentKeyPool };

interface AgentRowProps {
  agent: AgentItem;
  availableModels: string[];
  modelVariantMap: ModelVariantMap;
  modelDraft: string;
  variantDraft: string;
  keyDraft: string;
  keyPoolDraft: AgentKeyPool;
  dispatch: Dispatch<AgentRowAction>;
  busy: boolean;
  onRename: (agent: AgentItem) => void;
  onUpdate: (agent: AgentItem) => void;
  onDelete: (agent: AgentItem) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentRow({
  agent,
  availableModels,
  modelVariantMap,
  modelDraft,
  variantDraft,
  keyDraft,
  keyPoolDraft,
  dispatch,
  busy,
  onRename,
  onUpdate,
  onDelete,
}: AgentRowProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-[var(--color-line)] p-3 md:grid-cols-[220px_1fr_180px_220px_auto_auto_auto] md:items-end">
      <FormField label="Agent key">
        <Input
          type="text"
          value={keyDraft}
          onChange={(event) =>
            dispatch({
              type: "SET_KEY_DRAFT",
              agentKey: agent.key,
              value: event.target.value,
            })
          }
        />
      </FormField>

      <FormField label="Model">
        <Select
          value={modelDraft}
          onChange={(event) => {
            const nextModel = event.target.value;
            dispatch({
              type: "SET_MODEL_DRAFT",
              agentKey: agent.key,
              value: nextModel,
            });

            const variantOptions = resolveVariantOptions(
              nextModel,
              modelVariantMap,
            );
            const currentVariant = variantDraft.trim();
            if (currentVariant && !variantOptions.includes(currentVariant)) {
              dispatch({
                type: "SET_VARIANT_DRAFT",
                agentKey: agent.key,
                value: "",
              });
            }
          }}
        >
          <option value="">Select model</option>
          {toSelectOptions(availableModels, modelDraft).map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Reasoning">
        <Select
          value={variantDraft}
          onChange={(event) =>
            dispatch({
              type: "SET_VARIANT_DRAFT",
              agentKey: agent.key,
              value: event.target.value,
            })
          }
        >
          <option value="">Default</option>
          {toVariantOptions(
            modelDraft || readModel(agent.definition),
            variantDraft || readVariant(agent.definition),
            modelVariantMap,
          ).map((variant) => (
            <option key={variant} value={variant}>
              {formatVariantLabel(variant)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Key pool">
        <Select
          value={keyPoolDraft}
          onChange={(event) =>
            dispatch({
              type: "SET_KEY_POOL_DRAFT",
              agentKey: agent.key,
              value: event.target.value as AgentKeyPool,
            })
          }
        >
          {KEY_POOL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>

      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => onRename(agent)}
      >
        Rename
      </Button>

      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => onUpdate(agent)}
      >
        Save
      </Button>

      <Button
        size="sm"
        variant="danger"
        disabled={busy}
        onClick={() => onDelete(agent)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}

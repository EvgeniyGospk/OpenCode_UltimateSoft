import type { Dispatch } from "react";
import { Bot, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onSave: (agent: AgentItem) => void;
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
  onSave,
  onDelete,
}: AgentRowProps) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
        <Bot className="h-5 w-5 shrink-0 text-[var(--color-muted)]" />
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
          className="flex-1 border-transparent bg-transparent text-base font-semibold hover:border-[var(--color-line)] focus:border-[var(--color-line)]"
        />
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onSave(agent)}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => onDelete(agent)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Body — 3-column grid */}
      <div className="grid gap-4 px-4 py-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-muted)]">Model</label>
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
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-muted)]">Reasoning</label>
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
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-muted)]">Key pool</label>
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
        </div>
      </div>
    </div>
  );
}

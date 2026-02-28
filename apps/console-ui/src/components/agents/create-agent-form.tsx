import type { Dispatch } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AgentKeyPool, ModelCatalog, ModelVariantMap } from "@/lib/agents-domain";
import {
  composeModelRef,
  formatVariantLabel,
  parseModelRef,
  toVariantOptions,
} from "@/lib/agents-domain";
import { KEY_POOL_OPTIONS, clampVariant } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Actions the create form dispatches back to the parent reducer. */
export type CreateFormAction =
  | { type: "SET_NEW_KEY"; value: string }
  | { type: "SET_NEW_MODEL_PREFIX"; value: string }
  | { type: "SET_NEW_MODEL"; value: string }
  | { type: "SET_NEW_VARIANT"; value: string }
  | { type: "SET_NEW_KEY_POOL"; value: AgentKeyPool };

interface CreateAgentFormProps {
  newKey: string;
  newModelPrefix: string;
  newModel: string;
  newVariant: string;
  newKeyPool: AgentKeyPool;
  modelCatalog: ModelCatalog;
  modelVariantMap: ModelVariantMap;
  dispatch: Dispatch<CreateFormAction>;
  busy: boolean;
  onCreate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateAgentForm({
  newKey,
  newModelPrefix,
  newModel,
  newVariant,
  newKeyPool,
  modelCatalog,
  modelVariantMap,
  dispatch,
  busy,
  onCreate,
}: CreateAgentFormProps) {
  const createModelIds = modelCatalog.modelIdsByPrefix[newModelPrefix] ?? [];
  const parsedNewModel = parseModelRef(newModel);
  const selectedModelId =
    parsedNewModel.prefix === newModelPrefix ? parsedNewModel.modelId : "";
  const createVariantOptions = toVariantOptions(
    newModel,
    newVariant,
    modelVariantMap,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Agent</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_1fr_180px_220px_auto] md:items-end">
        <FormField label="Agent key">
          <Input
            type="text"
            value={newKey}
            onChange={(event) =>
              dispatch({ type: "SET_NEW_KEY", value: event.target.value })
            }
            placeholder="e.g. planner"
          />
        </FormField>

        <FormField label="Model prefix">
          <Select
            value={newModelPrefix}
            onChange={(event) => {
              const nextPrefix = event.target.value;
              dispatch({ type: "SET_NEW_MODEL_PREFIX", value: nextPrefix });

              const firstModelId =
                modelCatalog.modelIdsByPrefix[nextPrefix]?.[0] ?? "";
              const nextModel = composeModelRef(nextPrefix, firstModelId);
              dispatch({ type: "SET_NEW_MODEL", value: nextModel });

              dispatch({
                type: "SET_NEW_VARIANT",
                value: clampVariant(newVariant, nextModel, modelVariantMap),
              });
            }}
          >
            <option value="">Select prefix</option>
            {modelCatalog.prefixes.map((prefix) => (
              <option key={prefix || "__none"} value={prefix}>
                {prefix || "(no prefix)"}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Model">
          <Select
            value={selectedModelId}
            onChange={(event) => {
              const nextModel = composeModelRef(
                newModelPrefix,
                event.target.value,
              );
              dispatch({ type: "SET_NEW_MODEL", value: nextModel });

              dispatch({
                type: "SET_NEW_VARIANT",
                value: clampVariant(newVariant, nextModel, modelVariantMap),
              });
            }}
          >
            <option value="">
              {createModelIds.length === 0
                ? "No provider models detected"
                : "Select model"}
            </option>
            {createModelIds.map((modelId) => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Reasoning">
          <Select
            value={newVariant}
            onChange={(event) =>
              dispatch({ type: "SET_NEW_VARIANT", value: event.target.value })
            }
          >
            <option value="">Default</option>
            {createVariantOptions.map((variant) => (
              <option key={variant} value={variant}>
                {formatVariantLabel(variant)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Key pool">
          <Select
            value={newKeyPool}
            onChange={(event) =>
              dispatch({
                type: "SET_NEW_KEY_POOL",
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
          variant="primary"
          size="sm"
          onClick={onCreate}
          disabled={busy}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create
        </Button>
      </CardContent>
    </Card>
  );
}

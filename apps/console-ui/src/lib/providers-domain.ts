/**
 * Pure utility functions for the Providers domain.
 *
 * Extracted from providers-page.tsx so that the page component is focused
 * exclusively on rendering and state orchestration.
 */

import { isJsonObject } from "@/lib/guards";

export type { ProviderItem } from "./agents-domain";

import type { ProviderItem } from "./agents-domain";

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function toProviderItemsFromConfig(value: unknown): ProviderItem[] {
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

export function toDraftMap(items: ProviderItem[]): Record<string, string> {
  const nextDrafts: Record<string, string> = {};

  for (const item of items) {
    nextDrafts[item.key] = formatJson(item.definition);
  }

  return nextDrafts;
}

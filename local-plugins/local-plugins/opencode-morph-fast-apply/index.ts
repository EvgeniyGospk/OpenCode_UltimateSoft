/**
 * OpenCode Morph Fast Apply Plugin — Multi-key edition
 *
 * Поддерживает пул API ключей. При 429 ключ автоматически удаляется
 * из пула и используется следующий. Ключи читаются из:
 *   1. ~/.config/opencode/morph-keys.json  (массив строк ["sk-...", ...])
 *   2. MORPH_API_KEY env var (fallback на один ключ)
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import { createTwoFilesPatch } from "diff";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ─── Конфиг ──────────────────────────────────────────────────────────────────
const MORPH_API_URL = process.env.MORPH_API_URL || "https://api.morphllm.com";
const MORPH_MODEL = process.env.MORPH_MODEL || "morph-v3-fast";
const MORPH_TIMEOUT = parseInt(process.env.MORPH_TIMEOUT || "30000", 10);
const KEYS_FILE = join(homedir(), ".config", "opencode", "morph-keys.json");
const PLUGIN_VERSION = "2.0.0-multikey";
const EXISTING_CODE_MARKER = "// ... existing code ...";
const READONLY_AGENTS = ["plan", "explore"];
const ALLOW_READONLY_AGENTS = process.env.MORPH_ALLOW_READONLY_AGENTS === "true";

// ─── Пул ключей ──────────────────────────────────────────────────────────────
function loadKeys(): string[] {
  // 1. Из файла
  if (existsSync(KEYS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(KEYS_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
  }
  // 2. Из env
  if (process.env.MORPH_API_KEY) return [process.env.MORPH_API_KEY];
  return [];
}

function saveKeys(keys: string[]): void {
  try {
    writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), "utf-8");
  } catch {}
}

function getActiveKey(): string | null {
  const keys = loadKeys();
  return keys.length > 0 ? keys[0] : null;
}

function burnKey(badKey: string): string | null {
  const keys = loadKeys();
  const filtered = keys.filter(k => k !== badKey);
  saveKeys(filtered);
  process.stderr.write(`[morph] Ключ сожжён (429): ${badKey.slice(0, 20)}... Осталось: ${filtered.length}\n`);
  return filtered.length > 0 ? filtered[0] : null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateUnifiedDiff(filepath: string, original: string, modified: string): string {
  const patch = createTwoFilesPatch(`a/${filepath}`, `b/${filepath}`, original, modified, "", "", { context: 3 });
  return patch.includes("@@") ? patch : "No changes detected";
}

function countChanges(diff: string): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { added, removed };
}

function normalizeCodeEditInput(codeEdit: string): string {
  const trimmed = codeEdit.trim();
  const lines = trimmed.split("\n");
  if (lines.length >= 3 && /^```[\w-]*$/.test(lines[0]) && /^```$/.test(lines[lines.length - 1])) {
    return lines.slice(1, -1).join("\n");
  }
  return codeEdit;
}

// ─── Morph API с авторотацией ключей ─────────────────────────────────────────
async function callMorphApply(
  originalCode: string,
  codeEdit: string,
  instructions: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
  let key = getActiveKey();

  while (key) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MORPH_TIMEOUT);

    try {
      const response = await fetch(`${MORPH_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MORPH_MODEL,
          messages: [{
            role: "user",
            content: `<instruction>${instructions}</instruction>\n<code>${originalCode}</code>\n<update>${codeEdit}</update>`,
          }],
          temperature: 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 429 — ключ исчерпан, сжигаем и пробуем следующий
      if (response.status === 429) {
        key = burnKey(key);
        if (!key) {
          return { success: false, error: "Все API ключи исчерпаны (429). Добавьте новые ключи в morph-keys.json" };
        }
        continue; // retry с новым ключом
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Morph API error (${response.status}): ${errorText}` };
      }

      const result = await response.json() as { choices: Array<{ message: { content: string } }> };
      const mergedCode = result.choices?.[0]?.message?.content;

      if (!mergedCode) {
        return { success: false, error: "Morph API вернул пустой ответ" };
      }

      return { success: true, content: mergedCode };

    } catch (err) {
      clearTimeout(timeoutId);
      const error = err as Error;
      if (error.name === "AbortError") {
        return { success: false, error: `Morph API timeout (${MORPH_TIMEOUT}ms)` };
      }
      return { success: false, error: `Morph API request failed: ${error.message}` };
    }
  }

  return { success: false, error: "MORPH_API_KEY не настроен. Добавьте ключи в ~/.config/opencode/morph-keys.json" };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────
const MorphFastApply: Plugin = async ({ directory, client }) => {
  const log = async (level: "debug" | "info" | "warn" | "error", message: string) => {
    try {
      await client.app.log({ body: { service: "morph-fast-apply", level, message } });
    } catch {
      process.stderr.write(`[morph-fast-apply] ${message}\n`);
    }
  };

  const keyCount = loadKeys().length;
  if (keyCount === 0) {
    await log("warn", "Нет API ключей Morph. Добавьте в ~/.config/opencode/morph-keys.json");
  } else {
    await log("info", `Плагин загружен. Ключей в пуле: ${keyCount}, модель: ${MORPH_MODEL}`);
  }

  return {
    tool: {
      morph_edit: tool({
        description: `Use this tool to edit existing files by showing only the changed lines.

USAGE GUIDELINES:
- Use 'morph_edit' for: multi-hunk edits, large files (300+ lines), complex refactoring.
- Use native 'edit' for: simple single-string replacements, small files (<50 lines), new files.

Use "// ... existing code ..." to represent unchanged code blocks.

Example:
// ... existing code ...
FIRST_EDIT
// ... existing code ...
SECOND_EDIT
// ... existing code ...

Rules:
- ALWAYS wrap changes with markers at start AND end
- Preserve exact indentation
- Batch multiple edits to the same file in one call`,

        args: {
          target_filepath: tool.schema.string().describe("Path of the file to modify"),
          instructions: tool.schema.string().describe("Brief description of what you're changing"),
          code_edit: tool.schema.string().describe('Code changes wrapped with "// ... existing code ..." markers'),
        },

        async execute(args, context) {
          const { target_filepath, instructions, code_edit } = args;
          const normalizedCodeEdit = normalizeCodeEditInput(code_edit);

          // Блокируем в readonly агентах
          if (!ALLOW_READONLY_AGENTS && READONLY_AGENTS.includes(context.agent)) {
            return `Error: morph_edit не доступен в режиме ${context.agent} (readonly).`;
          }

          const filepath = target_filepath.startsWith("/")
            ? target_filepath
            : `${directory}/${target_filepath}`;

          // Проверяем наличие ключей
          if (!getActiveKey()) {
            return `Error: Нет ключей Morph API.

Добавьте ключи в ~/.config/opencode/morph-keys.json:
["sk-ключ1", "sk-ключ2", ...]

Или используйте native 'edit' tool.`;
          }

          // Читаем файл
          let originalCode: string;
          try {
            const file = Bun.file(filepath);
            if (!(await file.exists())) {
              if (!normalizedCodeEdit.includes(EXISTING_CODE_MARKER)) {
                await Bun.write(filepath, normalizedCodeEdit);
                return `Created new file: ${target_filepath}\n\nLines: ${normalizedCodeEdit.split("\n").length}`;
              }
              return `Error: Файл не найден: ${target_filepath}`;
            }
            originalCode = await file.text();
          } catch (err) {
            return `Error reading file ${target_filepath}: ${(err as Error).message}`;
          }

          const hasMarkers = normalizedCodeEdit.includes(EXISTING_CODE_MARKER);
          const originalLineCount = originalCode.split("\n").length;

          if (!hasMarkers && originalLineCount > 10) {
            return `Error: Отсутствуют маркеры "${EXISTING_CODE_MARKER}".

Оберни изменения маркерами:
${EXISTING_CODE_MARKER}
ТВОИ_ИЗМЕНЕНИЯ
${EXISTING_CODE_MARKER}`;
          }

          // Вызываем Morph API (с авторотацией ключей)
          const startTime = Date.now();
          const result = await callMorphApply(originalCode, normalizedCodeEdit, instructions);
          const apiDuration = Date.now() - startTime;

          if (!result.success || !result.content) {
            return `Morph API failed: ${result.error}\n\nИспользуй native 'edit' tool.`;
          }

          const mergedCode = result.content;

          // Guard: marker leakage
          const originalHadMarker = originalCode.includes(EXISTING_CODE_MARKER);
          if (hasMarkers && !originalHadMarker && mergedCode.includes(EXISTING_CODE_MARKER)) {
            return `Morph: заблокировано (marker leakage) для ${target_filepath}.\nФайл не изменён.`;
          }

          // Guard: catastrophic truncation
          const mergedLineCount = mergedCode.split("\n").length;
          const charLoss = (originalCode.length - mergedCode.length) / originalCode.length;
          const lineLoss = (originalLineCount - mergedLineCount) / originalLineCount;
          if (hasMarkers && charLoss > 0.6 && lineLoss > 0.5) {
            return `Morph: заблокировано (truncation ${Math.round(charLoss*100)}% char, ${Math.round(lineLoss*100)}% lines) для ${target_filepath}.\nФайл не изменён.`;
          }

          // Записываем результат
          try {
            await Bun.write(filepath, mergedCode);
          } catch (err) {
            return `Error writing ${target_filepath}: ${(err as Error).message}`;
          }

          const diff = generateUnifiedDiff(target_filepath, originalCode, mergedCode);
          const { added, removed } = countChanges(diff);

          // Логируем сколько ключей осталось
          const remaining = loadKeys().length;
          await log("info", `Ключей осталось в пуле: ${remaining}`);

          return `Applied edit to ${target_filepath}

+${added} -${removed} lines | ${originalLineCount} -> ${mergedCode.split("\n").length} total | ${apiDuration}ms | Keys left: ${remaining}

\`\`\`diff
${diff.slice(0, 3000)}${diff.length > 3000 ? "\n... (truncated)" : ""}
\`\`\``;
        },
      }),
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool === "morph_edit") {
        const fileMatch = output.output.match(/Applied edit to (.+?)\n/);
        const statsMatch = output.output.match(/\+(\d+) -(\d+) lines/);
        const timingMatch = output.output.match(/\| (\d+)ms/);
        const keysMatch = output.output.match(/Keys left: (\d+)/);
        const createdMatch = output.output.match(/Created new file: (.+?)\n/);

        if (createdMatch) {
          output.title = `Morph: ${createdMatch[1]} (new)`;
        } else if (fileMatch && statsMatch) {
          const timing = timingMatch ? ` (${timingMatch[1]}ms)` : "";
          const keys = keysMatch ? ` [keys:${keysMatch[1]}]` : "";
          output.title = `Morph: ${fileMatch[1]} +${statsMatch[1]}/-${statsMatch[2]}${timing}${keys}`;
        } else if (output.output.includes("заблокировано")) {
          output.title = `Morph: blocked`;
        } else if (output.output.includes("API failed") || output.output.includes("Error:")) {
          output.title = `Morph: failed`;
        }

        output.metadata = { ...output.metadata, provider: "morph", version: PLUGIN_VERSION, model: MORPH_MODEL };
      }
    },
  };
};

export default MorphFastApply;

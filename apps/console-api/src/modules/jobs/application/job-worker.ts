import type { JobRecord } from "../domain/job-types.js";
import type { IJobStore } from "../domain/store-interfaces.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;
const ASYNC_POLL_INTERVAL_MS = 3_000;

/* ------------------------------------------------------------------ */
/*  Server connection helpers                                          */
/* ------------------------------------------------------------------ */

function resolveServerUrl(): string | undefined {
  return process.env.OPENCODE_SERVER_URL || undefined;
}

function resolveAuthHeader(): string | undefined {
  const user = process.env.OPENCODE_SERVER_USERNAME;
  const pass = process.env.OPENCODE_SERVER_PASSWORD;
  if (user && pass) {
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }
  return undefined;
}

interface ServerConfig {
  url: string;
  auth?: string;
}

/* ------------------------------------------------------------------ */
/*  Agent metadata cache                                               */
/* ------------------------------------------------------------------ */

interface AgentMeta {
  name: string;
  providerID: string;
  modelID: string;
  mode: string;
}

/**
 * Providers whose models hang when called via POST /session/{id}/message
 * in OpenCode 1.2.15 (Codex OAuth streaming incompatibility).
 *
 * For these providers the worker falls back to the orchestrator agent (`build`)
 * and runs the user prompt directly.  Task-tool delegation is NOT used because
 * the delegated agent would still call the broken provider under the hood.
 */
const BROKEN_API_PROVIDERS = new Set(["openai"]);

/**
 * The orchestrator agent used for delegation when direct call is unavailable.
 */
const ORCHESTRATOR_AGENT = "build";

/* ------------------------------------------------------------------ */
/*  Worker                                                             */
/* ------------------------------------------------------------------ */

/**
 * Background worker that polls for pending jobs and executes them
 * by calling the OpenCode server HTTP API directly.
 *
 * Handles two execution paths:
 *   1. **Direct call** — for agents on Anthropic / Google Vertex providers,
 *      the worker sends the prompt directly with `agent` field.
 *   2. **Delegated call** — for agents on Codex (OpenAI) provider, the worker
 *      sends the prompt through `build` (orchestrator) and asks it to delegate
 *      via the Task tool.  This works around a streaming bug in OpenCode 1.2.15.
 */
export class SmokeWorker {
  private readonly store: IJobStore;
  private readonly timeoutMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private processing = false;
  private readonly activeAbortControllers = new Map<string, AbortController>();
  private serverConfig: ServerConfig | null = null;

  /** Cached agent metadata from the OpenCode server. */
  private agentMeta: Map<string, AgentMeta> | null = null;

  constructor(
    store: IJobStore,
    options?: { serverUrl?: string; timeoutMs?: number }
  ) {
    this.store = store;
    this.timeoutMs =
      options?.timeoutMs ??
      (Number(process.env.SMOKE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

    const url = options?.serverUrl ?? resolveServerUrl();
    if (url) {
      this.serverConfig = { url: url.replace(/\/+$/, ""), auth: resolveAuthHeader() };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollTimer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const [, ctrl] of this.activeAbortControllers) {
      ctrl.abort();
    }
    this.activeAbortControllers.clear();
  }

  killJob(jobId: string): boolean {
    const ctrl = this.activeAbortControllers.get(jobId);
    if (ctrl) {
      ctrl.abort();
      this.activeAbortControllers.delete(jobId);
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Polling                                                            */
  /* ------------------------------------------------------------------ */

  private async tick(): Promise<void> {
    if (!this.running || this.processing) return;

    const pending = this.store.getByStatus("pending");
    if (pending.length === 0) return;

    const job = pending[0]!;
    this.processing = true;
    try {
      await this.processJob(job);
    } finally {
      this.processing = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Server API helpers                                                 */
  /* ------------------------------------------------------------------ */

  private getServerConfig(): ServerConfig | null {
    if (this.serverConfig) return this.serverConfig;
    const url = resolveServerUrl();
    if (url) {
      this.serverConfig = { url: url.replace(/\/+$/, ""), auth: resolveAuthHeader() };
      return this.serverConfig;
    }
    return null;
  }

  private async serverFetch(path: string, init?: RequestInit): Promise<Response> {
    const cfg = this.getServerConfig();
    if (!cfg) throw new Error("OpenCode server URL not configured");

    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (cfg.auth) headers["Authorization"] = cfg.auth;
    return fetch(`${cfg.url}${path}`, { ...init, headers });
  }

  /* ------------------------------------------------------------------ */
  /*  Agent metadata                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Fetch agent list from the running OpenCode server and cache it.
   * Returns the provider for a given agent key, or undefined.
   */
  private async fetchAgentMeta(): Promise<Map<string, AgentMeta>> {
    if (this.agentMeta) return this.agentMeta;

    try {
      const res = await this.serverFetch("/agent");
      if (res.ok) {
        const agents = (await res.json()) as Array<{
          name: string;
          mode: string;
          model: { providerID: string; modelID: string };
        }>;
        const map = new Map<string, AgentMeta>();
        for (const a of agents) {
          map.set(a.name, {
            name: a.name,
            providerID: a.model.providerID,
            modelID: a.model.modelID,
            mode: a.mode,
          });
        }
        this.agentMeta = map;
        return map;
      }
    } catch {
      // ignore — will use fallback
    }
    return new Map();
  }

  private async needsDelegation(agentKey: string): Promise<boolean> {
    const meta = await this.fetchAgentMeta();
    const agent = meta.get(agentKey);
    if (!agent) return false; // unknown agent — try direct
    return BROKEN_API_PROVIDERS.has(agent.providerID);
  }

  /* ------------------------------------------------------------------ */
  /*  Job execution                                                      */
  /* ------------------------------------------------------------------ */

  async processJob(job: JobRecord): Promise<void> {
    const now = new Date().toISOString();
    this.store.updateStatus(job.id, "running", { startedAt: now });

    const cfg = this.getServerConfig();
    if (!cfg) {
      this.store.updateStatus(job.id, "failed", {
        finishedAt: new Date().toISOString(),
        exitCode: 1,
        error: "OpenCode server URL not configured. Set OPENCODE_SERVER_URL env var.",
      });
      return;
    }

    const abortCtrl = new AbortController();
    this.activeAbortControllers.set(job.id, abortCtrl);

    const timeoutHandle = setTimeout(() => {
      abortCtrl.abort();
      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stderr",
        line: `[worker] Job killed: timeout after ${this.timeoutMs}ms`,
      });
    }, this.timeoutMs);

    try {
      // --- Resolve execution strategy ---
      const fallback = await this.needsDelegation(job.agentKey);
      const effectiveAgent = fallback ? ORCHESTRATOR_AGENT : (job.agentKey || ORCHESTRATOR_AGENT);
      const effectivePrompt = fallback
        ? this.buildFallbackPrompt(job.agentKey, job.prompt)
        : job.prompt;

      const strategyLabel = fallback
        ? `fallback: ${job.agentKey} (${this.agentMeta?.get(job.agentKey)?.providerID ?? "?"}) -> ${ORCHESTRATOR_AGENT}`
        : `direct (${effectiveAgent})`;

      // --- 1. Create session ---
      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stdout",
        line: `[worker] Strategy: ${strategyLabel}`,
      });

      const sessionRes = await this.serverFetch("/session", {
        method: "POST",
        signal: abortCtrl.signal,
      });

      if (!sessionRes.ok) {
        throw new Error(
          `Failed to create session: HTTP ${sessionRes.status} ${await sessionRes.text()}`
        );
      }

      const session = (await sessionRes.json()) as { id: string };
      const sessionId = session.id;

      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stdout",
        line: `[worker] Session: ${sessionId}`,
      });

      // --- 2. Send message (async — fire and forget) ---
      const messageBody: Record<string, unknown> = {
        parts: [{ type: "text", text: effectivePrompt }],
        agent: effectiveAgent,
      };

      const asyncRes = await this.serverFetch(
        `/session/${sessionId}/prompt_async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageBody),
          signal: abortCtrl.signal,
        }
      );

      if (!asyncRes.ok && asyncRes.status !== 204) {
        throw new Error(
          `Failed to send async prompt: HTTP ${asyncRes.status} ${await asyncRes.text()}`
        );
      }

      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stdout",
        line: `[worker] Prompt sent (async), polling for completion...`,
      });

      // --- 3. Poll for completion ---
      const msgData = await this.pollForCompletion(sessionId, abortCtrl.signal, job.id);

      if (!msgData) {
        // Cancelled or aborted during polling
        const current = this.store.getById(job.id);
        if (current?.status === "cancelled") return;
        throw new Error("Polling ended without result");
      }

      const textParts = (msgData.parts ?? [])
        .filter((p: any) => p.type === "text" && (p.text || p.content))
        .map((p: any) => p.text || p.content || "");

      const output = textParts.join("\n");
      if (output) {
        for (const line of output.split("\n")) {
          this.store.appendLog({
            jobId: job.id,
            timestamp: new Date().toISOString(),
            stream: "stdout",
            line,
          });
        }
      }

      const info = msgData.info;
      if (info) {
        const meta = [
          `agent=${info.agent ?? "?"}`,
          `model=${info.providerID ?? "?"}/${info.modelID ?? "?"}`,
          `tokens=${info.tokens?.total ?? 0}`,
          `cost=$${(info.cost ?? 0).toFixed(4)}`,
          `finish=${info.finish ?? "?"}`,
        ].join(" ");

        this.store.appendLog({
          jobId: job.id,
          timestamp: new Date().toISOString(),
          stream: "stdout",
          line: `[worker] ${meta}`,
        });
      }

      // Check for errors in the assistant message
      if (info?.error) {
        throw new Error(`AI error: ${JSON.stringify(info.error)}`);
      }

      // Check if cancelled
      const current = this.store.getById(job.id);
      if (current?.status === "cancelled") return;

      this.store.updateStatus(job.id, "success", {
        finishedAt: new Date().toISOString(),
        exitCode: 0,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      this.activeAbortControllers.delete(job.id);

      const current = this.store.getById(job.id);
      if (current?.status === "cancelled") return;

      const errorMsg = err instanceof Error ? err.message : String(err);
      const isAbort = err instanceof DOMException && err.name === "AbortError";

      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stderr",
        line: `[worker] ${isAbort ? "Aborted" : "Error"}: ${errorMsg}`,
      });

      this.store.updateStatus(job.id, "failed", {
        finishedAt: new Date().toISOString(),
        exitCode: 1,
        error: isAbort ? "Job timed out or was aborted" : errorMsg,
      });
      return;
    }

    clearTimeout(timeoutHandle);
    this.activeAbortControllers.delete(job.id);
  }

  /* ------------------------------------------------------------------ */
  /*  Async polling                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Poll GET /session/{id}/message until the assistant message has a
   * `finish` field set (meaning the AI has finished responding).
   * Returns the completed assistant message with parts, or null if aborted.
   */
  private async pollForCompletion(
    sessionId: string,
    signal: AbortSignal,
    jobId: string,
  ): Promise<any | null> {
    while (!signal.aborted) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ASYNC_POLL_INTERVAL_MS);
        const onAbort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
        signal.addEventListener("abort", onAbort, { once: true });
      }).catch(() => null);

      if (signal.aborted) return null;

      // Check if job was cancelled externally
      const current = this.store.getById(jobId);
      if (current?.status === "cancelled") return null;

      try {
        const res = await this.serverFetch(`/session/${sessionId}/message`, {
          signal,
        });
        if (!res.ok) continue;

        const messages = (await res.json()) as Array<{
          info: {
            role: string;
            finish?: string;
            agent?: string;
            modelID?: string;
            providerID?: string;
            tokens?: { input?: number; output?: number; total?: number };
            cost?: number;
            error?: unknown;
          };
          parts: Array<{ type: string; text?: string; content?: string }>;
        }>;

        // Find the last assistant message
        const assistant = messages
          .filter((m) => m.info.role === "assistant")
          .pop();

        if (assistant?.info.finish) {
          return assistant;
        }

        // Log progress — count parts
        const partCount = assistant?.parts?.length ?? 0;
        if (partCount > 0) {
          this.store.appendLog({
            jobId,
            timestamp: new Date().toISOString(),
            stream: "stdout",
            line: `[worker] Processing... (${partCount} parts so far)`,
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        // Transient fetch error — keep polling
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Delegation prompt builder                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Wraps the user prompt when the requested agent's provider is unavailable
   * via the HTTP API.  The fallback runs `build` (Anthropic) with the
   * original prompt and a note explaining which agent was requested.
   */
  private buildFallbackPrompt(targetAgent: string, userPrompt: string): string {
    return [
      `[Note: the user requested agent "${targetAgent}" but its provider is temporarily unavailable via API.`,
      `You (build) are handling this request directly instead. Answer as helpfully as you can.]`,
      ``,
      userPrompt,
    ].join("\n");
  }
}

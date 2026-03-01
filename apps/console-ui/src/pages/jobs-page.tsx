import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { StatusMessages } from "@/components/ui/status-messages";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import type { JobLogEntry, JobRecord } from "@/lib/jobs-domain";
import {
  formatDuration,
  getStatusLabel,
} from "@/lib/jobs-domain";
import { useAsync } from "@/lib/useAsync";

// ---------------------------------------------------------------------------
// Status badge (Tailwind colour classes per status)
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<JobRecord["status"], string> = {
  pending: "bg-zinc-400",
  running: "bg-blue-500",
  success: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-amber-500",
};

const STATUS_TEXT: Record<JobRecord["status"], string> = {
  pending: "text-zinc-600",
  running: "text-blue-600",
  success: "text-green-600",
  failed: "text-red-600",
  cancelled: "text-amber-600",
};

function StatusBadge({ status }: { status: JobRecord["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT[status]}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
      />
      {getStatusLabel(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Terminal-style log viewer
// ---------------------------------------------------------------------------

/** Strip ANSI escape sequences (colors, bold, etc.) from a string. */
function stripAnsi(text: string): string {
  // Matches: ESC[ … m  |  ESC(B  |  ESC]…ST  and other common sequences
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\([A-Za-z]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "");
}

function LogViewer({ logs }: { logs: JobLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-zinc-500">No log entries yet.</p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="mt-3 max-h-80 overflow-y-auto overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 sm:p-4"
    >
      <div className="font-mono text-[11px] leading-relaxed text-zinc-300 sm:text-xs">
        {logs.map((entry) => {
          const cleaned = stripAnsi(entry.line);
          const isFallback = cleaned.includes("[worker] Strategy: fallback:");
          const isWorkerMeta = !isFallback && cleaned.startsWith("[worker]");

          let lineClass = "";
          if (entry.stream === "stderr") lineClass = "text-red-400";
          else if (isFallback) lineClass = "text-amber-400";
          else if (isWorkerMeta) lineClass = "text-zinc-500";

          return (
            <div key={entry.id} className={lineClass}>
              <span className="mr-2 text-zinc-500">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {isFallback && (
                <span className="mr-1.5 inline-block rounded bg-amber-900/40 px-1 py-0.5 text-[10px] text-amber-300">
                  FALLBACK
                </span>
              )}
              {cleaned}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create-job form (dashed dropzone style)
// ---------------------------------------------------------------------------

const DEFAULT_SMOKE_PROMPT =
  "List the files in the current directory and briefly describe the project structure.";

interface CreateJobFormProps {
  busy: boolean;
  agentKeys: string[];
  onSubmit: (agentKey: string, prompt: string) => void;
  onCancel: () => void;
}

function CreateJobForm({ busy, agentKeys = [], onSubmit, onCancel }: CreateJobFormProps) {
  const [agentKey, setAgentKey] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_SMOKE_PROMPT);

  // Auto-select first agent when the list arrives (or changes).
  useEffect(() => {
    if (!agentKey && agentKeys.length > 0) {
      setAgentKey(agentKeys[0]);
    }
  }, [agentKeys, agentKey]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agentKey.trim() || !prompt.trim()) return;
    onSubmit(agentKey.trim(), prompt.trim());
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-dashed border-[var(--color-line)] bg-zinc-50/50 p-3 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          Draft New Job
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-[var(--color-muted)] hover:bg-zinc-100 hover:text-[var(--color-ink)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-[1fr_2fr_auto]">
          <FormField label="Agent Key">
            <Select
              value={agentKey}
              onChange={(e) => setAgentKey(e.target.value)}
              required
            >
              {agentKeys.length === 0 && (
                <option value="">No agents available</option>
              )}
              {agentKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Prompt">
            <Textarea
              placeholder="Enter the prompt for the smoke job..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              required
            />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" variant="primary" size="sm" disabled={busy || agentKeys.length === 0} className="w-full sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job card
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: JobRecord;
  expanded: boolean;
  logs: JobLogEntry[];
  logsLoading: boolean;
  onToggleLogs: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  busyAction: string | null;
}

function JobCard({
  job,
  expanded,
  logs,
  logsLoading,
  onToggleLogs,
  onCancel,
  onRetry,
  busyAction,
}: JobCardProps) {
  const canCancel = job.status === "pending" || job.status === "running";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const isBusy = busyAction === job.id;

  return (
    <Card className="p-3 sm:p-4">
      {/* Top row: status + agent key */}
      <div className="space-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-bold text-[var(--color-ink)]">
              {job.agentKey}
            </span>
            <StatusBadge status={job.status} />
          </div>

          {/* Prompt preview */}
          <p className="line-clamp-2 text-sm text-[var(--color-muted)]">
            {job.prompt}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-[var(--color-muted)]">
            <span>Duration: {formatDuration(job.startedAt, job.finishedAt)}</span>
            {job.exitCode !== undefined && job.exitCode !== null && (
              <span>Exit: {job.exitCode}</span>
            )}
            {job.error && (
              <span className="text-red-500">Error: {job.error}</span>
            )}
          </div>
        </div>

        {/* Action buttons — wrap on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleLogs(job.id)}
          >
            <Terminal className="mr-1 h-4 w-4" />
            Logs
          </Button>
          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              disabled={isBusy}
              onClick={() => onCancel(job.id)}
            >
              <Square className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
          {canRetry && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => onRetry(job.id)}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Expanded log viewer */}
      {expanded && (
        <>
          {logsLoading ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Loading logs...
            </p>
          ) : (
            <LogViewer logs={logs} />
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function JobsPage() {
  const [items, setItems] = useState<JobRecord[]>([]);
  const [agentKeys, setAgentKeys] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<JobLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const { loading, error, run } = useAsync();

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      ),
    [items]
  );

  const hasRunning = useMemo(
    () =>
      items.some(
        (job) => job.status === "running" || job.status === "pending"
      ),
    [items]
  );

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadJobs = useCallback(async () => {
    await run(async () => {
      const [jobsResponse, agentsResponse] = await Promise.all([
        apiClient.listJobs(),
        apiClient.listAgents(),
      ]);
      setItems(jobsResponse.data.items);
      setAgentKeys(agentsResponse.data.items.map((a) => a.key));
    });
  }, [run]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // Auto-refresh every 3s when there are running/pending jobs
  useEffect(() => {
    if (!hasRunning) return;

    const interval = setInterval(() => {
      void loadJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [hasRunning, loadJobs]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function handleCreateJob(agentKey: string, prompt: string) {
    try {
      setBusyAction("create");
      await run(async () => {
        await apiClient.createJob({ type: "smoke", agentKey, prompt });
        setShowForm(false);
        await loadJobs();
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancel(jobId: string) {
    try {
      setBusyAction(jobId);
      await run(async () => {
        await apiClient.cancelJob(jobId);
        await loadJobs();
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRetry(jobId: string) {
    try {
      setBusyAction(jobId);
      await run(async () => {
        await apiClient.retryJob(jobId);
        await loadJobs();
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleLogs(jobId: string) {
    if (expandedId === jobId) {
      setExpandedId(null);
      setLogs([]);
      return;
    }

    setExpandedId(jobId);
    setLogsLoading(true);

    try {
      const response = await apiClient.getJobLogs(jobId);
      setLogs(response.data.items);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Run and inspect smoke tasks from the console."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadJobs()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForm((prev) => !prev)}
            >
              <Play className="mr-2 h-4 w-4" />
              New smoke job
            </Button>
          </div>
        }
      />

      {showForm && (
        <CreateJobForm
          busy={busyAction === "create"}
          agentKeys={agentKeys}
          onSubmit={(agentKey, prompt) =>
            void handleCreateJob(agentKey, prompt)
          }
          onCancel={() => setShowForm(false)}
        />
      )}

      <StatusMessages
        loading={loading}
        error={error}
        isEmpty={!loading && items.length === 0}
        emptyText="No jobs found yet."
        loadingText="Loading jobs..."
        hasData={items.length > 0}
      />

      {hasRunning && (
        <p className="mb-3 text-xs text-[var(--color-accent)]">
          Auto-refreshing every 3 s...
        </p>
      )}

      <div className="space-y-3">
        {sortedItems.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            expanded={expandedId === job.id}
            logs={expandedId === job.id ? logs : []}
            logsLoading={expandedId === job.id && logsLoading}
            onToggleLogs={(id) => void handleToggleLogs(id)}
            onCancel={(id) => void handleCancel(id)}
            onRetry={(id) => void handleRetry(id)}
            busyAction={busyAction}
          />
        ))}
      </div>
    </div>
  );
}

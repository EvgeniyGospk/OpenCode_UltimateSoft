import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusMessages } from "@/components/ui/status-messages";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import type { JobLogEntry, JobRecord } from "@/lib/jobs-domain";
import {
  formatDuration,
  getStatusColor,
  getStatusLabel,
} from "@/lib/jobs-domain";
import { useAsync } from "@/lib/useAsync";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: JobRecord["status"] }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: getStatusColor(status),
        border: `1px solid ${getStatusColor(status)}`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: getStatusColor(status) }}
      />
      {getStatusLabel(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Log viewer
// ---------------------------------------------------------------------------

function LogViewer({ logs }: { logs: JobLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--color-muted)]">
        No log entries yet.
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-64 overflow-auto rounded-lg bg-[var(--color-surface)] p-3 font-mono text-xs leading-5"
    >
      {logs.map((entry) => (
        <div
          key={entry.id}
          className={
            entry.stream === "stderr"
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-ink)]"
          }
        >
          <span className="mr-2 text-[var(--color-muted)]">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
          {entry.line}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create job form
// ---------------------------------------------------------------------------

interface CreateJobFormProps {
  busy: boolean;
  onSubmit: (agentKey: string, prompt: string) => void;
  onCancel: () => void;
}

function CreateJobForm({ busy, onSubmit, onCancel }: CreateJobFormProps) {
  const [agentKey, setAgentKey] = useState("");
  const [prompt, setPrompt] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agentKey.trim() || !prompt.trim()) return;
    onSubmit(agentKey.trim(), prompt.trim());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Smoke Job</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Agent Key">
            <Input
              placeholder="e.g. explore"
              value={agentKey}
              onChange={(e) => setAgentKey(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Prompt">
            <Textarea
              placeholder="Enter the prompt for the smoke job..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              required
            />
          </FormField>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              <Play className="mr-2 h-4 w-4" />
              Create Job
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={busy}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Job row
// ---------------------------------------------------------------------------

interface JobRowProps {
  job: JobRecord;
  expanded: boolean;
  logs: JobLogEntry[];
  logsLoading: boolean;
  onToggleLogs: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  busyAction: string | null;
}

function JobRow({
  job,
  expanded,
  logs,
  logsLoading,
  onToggleLogs,
  onCancel,
  onRetry,
  busyAction,
}: JobRowProps) {
  const canCancel = job.status === "pending" || job.status === "running";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const isBusy = busyAction === job.id;

  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-medium">{job.agentKey}</span>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-[var(--color-muted)]">
            {job.prompt.length > 100
              ? `${job.prompt.slice(0, 100)}...`
              : job.prompt}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
            <span>
              Created: {new Date(job.createdAt).toLocaleString()}
            </span>
            <span>
              Duration: {formatDuration(job.startedAt, job.finishedAt)}
            </span>
            {job.exitCode !== undefined && job.exitCode !== null && (
              <span>Exit: {job.exitCode}</span>
            )}
            {job.error && (
              <span className="text-[var(--color-danger)]">
                Error: {job.error}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleLogs(job.id)}
          >
            {expanded ? (
              <ChevronDown className="mr-1 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4" />
            )}
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

      {expanded && (
        <div className="mt-3 border-t border-[var(--color-line)] pt-3">
          {logsLoading ? (
            <p className="text-xs text-[var(--color-muted)]">Loading logs...</p>
          ) : (
            <LogViewer logs={logs} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function JobsPage() {
  const [items, setItems] = useState<JobRecord[]>([]);
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
      const response = await apiClient.listJobs();
      setItems(response.data.items);
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
        <div className="mb-5">
          <CreateJobForm
            busy={busyAction === "create"}
            onSubmit={(agentKey, prompt) => void handleCreateJob(agentKey, prompt)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Jobs ({sortedItems.length})
            {hasRunning && (
              <span className="ml-2 text-xs font-normal text-[var(--color-accent)]">
                auto-refreshing
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusMessages
            loading={loading}
            error={error}
            isEmpty={!loading && items.length === 0}
            emptyText="No jobs found yet."
            loadingText="Loading jobs..."
          />

          {sortedItems.map((job) => (
            <JobRow
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
        </CardContent>
      </Card>
    </div>
  );
}

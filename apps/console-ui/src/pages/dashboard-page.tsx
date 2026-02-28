import { type ReactNode, useCallback, useEffect, useState } from "react";
import type {
  HealthEnvelope,
  ProfileStateEnvelope
} from "@opencode-console/api-client-generated";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessages } from "@/components/ui/status-messages";
import { apiClient } from "@/lib/api-client";
import { countObjectKeys } from "@/lib/guards";
import { useAsync } from "@/lib/useAsync";

// ---------------------------------------------------------------------------
// KPI metric card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  indicator,
}: {
  label: string;
  value: ReactNode;
  indicator?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {indicator}
        <p className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          {value}
        </p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const [healthData, setHealthData] = useState<HealthEnvelope | null>(null);
  const [profileData, setProfileData] = useState<ProfileStateEnvelope | null>(null);

  const health = useAsync();
  const profile = useAsync();
  const { run: healthRun } = health;
  const { run: profileRun } = profile;

  const fetchHealth = useCallback(async () => {
    await healthRun(async () => {
      const result = await apiClient.getHealth();
      setHealthData(result);
    });
  }, [healthRun]);

  const fetchActiveProfile = useCallback(async () => {
    await profileRun(async () => {
      const result = await apiClient.getActiveProfile();
      setProfileData(result);
    });
  }, [profileRun]);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchHealth(), fetchActiveProfile()]);
  }, [fetchHealth, fetchActiveProfile]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const agentCount = countObjectKeys(profileData?.data.opencodeJson.agent);
  const providerCount = countObjectKeys(profileData?.data.opencodeJson.provider);

  const apiStatus = healthData?.data.status ?? "—";
  const isOk = apiStatus === "ok";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Entry point for local console status and active profile context."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void loadAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <StatusMessages
        loading={health.loading || profile.loading}
        error={health.error ?? profile.error}
        loadingText="Loading dashboard..."
        hasData={healthData !== null || profileData !== null}
      />

      {/* KPI metric cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="API Status"
          value={apiStatus}
          indicator={
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                isOk ? "bg-green-500" : "bg-red-500"
              }`}
            />
          }
        />
        <MetricCard label="Agents" value={agentCount} />
        <MetricCard label="Providers" value={providerCount} />
        <MetricCard
          label="Version"
          value={healthData?.data.version ?? "—"}
        />
      </div>

      {/* Profile details */}
      {profileData && (
        <Card>
          <CardHeader>
            <CardTitle>Active Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Name:</span>{" "}
                {profileData.data.name}
              </p>
              <p>
                <span className="font-medium">Path:</span>{" "}
                {profileData.data.path}
              </p>
              <p>
                <span className="font-medium">Updated:</span>{" "}
                {new Date(profileData.data.updatedAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

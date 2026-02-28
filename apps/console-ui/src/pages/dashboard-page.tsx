import { useCallback, useEffect, useState } from "react";
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API Health</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusMessages loading={health.loading} error={health.error} loadingText="Loading health status..." />
            {healthData ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Status:</span> {healthData.data.status}
                </p>
                <p>
                  <span className="font-medium">Service:</span> {healthData.data.service}
                </p>
                <p>
                  <span className="font-medium">Version:</span> {healthData.data.version}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusMessages loading={profile.loading} error={profile.error} loadingText="Loading active profile..." />
            {profileData ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Name:</span> {profileData.data.name}
                </p>
                <p>
                  <span className="font-medium">Path:</span> {profileData.data.path}
                </p>
                <p>
                  <span className="font-medium">Updated:</span>{" "}
                  {new Date(profileData.data.updatedAt).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Agents:</span> {agentCount}
                </p>
                <p>
                  <span className="font-medium">Providers:</span> {providerCount}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

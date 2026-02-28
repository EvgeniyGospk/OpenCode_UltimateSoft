import { useEffect, useState } from "react";
import type {
  HealthEnvelope,
  ProfileStateEnvelope
} from "@opencode-console/api-client-generated";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

type HealthState = {
  loading: boolean;
  data: HealthEnvelope | null;
  error: string | null;
};

const initialState: HealthState = {
  loading: true,
  data: null,
  error: null
};

type ProfileState = {
  loading: boolean;
  data: ProfileStateEnvelope | null;
  error: string | null;
};

const initialProfileState: ProfileState = {
  loading: true,
  data: null,
  error: null
};

function countObjectKeys(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return 0;
  }

  return Object.keys(value).length;
}

export function DashboardPage() {
  const [healthState, setHealthState] = useState<HealthState>(initialState);
  const [profileState, setProfileState] = useState<ProfileState>(initialProfileState);

  async function fetchHealth() {
    try {
      const result = await apiClient.getHealth();
      setHealthState({
        loading: false,
        data: result,
        error: null
      });
    } catch (error: unknown) {
      setHealthState({
        loading: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  async function fetchActiveProfile() {
    try {
      const result = await apiClient.getActiveProfile();
      setProfileState({
        loading: false,
        data: result,
        error: null
      });
    } catch (error: unknown) {
      setProfileState({
        loading: false,
        data: null,
        error:
          error instanceof Error ? error.message : "Failed to fetch active profile"
      });
    }
  }

  async function loadHealth() {
    setHealthState((previous) => ({
      ...previous,
      loading: true,
      error: null
    }));

    setProfileState((previous) => ({
      ...previous,
      loading: true,
      error: null
    }));

    await Promise.all([fetchHealth(), fetchActiveProfile()]);
  }

  useEffect(() => {
    void fetchHealth();
    void fetchActiveProfile();
  }, []);

  const agentCount = countObjectKeys(profileState.data?.data.opencodeJson.agent);
  const providerCount = countObjectKeys(profileState.data?.data.opencodeJson.provider);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Entry point for local console status and active profile context."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void loadHealth()}>
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
            {healthState.loading ? (
              <p className="text-sm text-[var(--color-muted)]">Loading health status...</p>
            ) : null}
            {healthState.error ? (
              <p className="text-sm text-rose-700">{healthState.error}</p>
            ) : null}
            {healthState.data ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Status:</span> {healthState.data.data.status}
                </p>
                <p>
                  <span className="font-medium">Service:</span> {healthState.data.data.service}
                </p>
                <p>
                  <span className="font-medium">Version:</span> {healthState.data.data.version}
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
            {profileState.loading ? (
              <p className="text-sm text-[var(--color-muted)]">Loading active profile...</p>
            ) : null}
            {profileState.error ? (
              <p className="text-sm text-rose-700">{profileState.error}</p>
            ) : null}
            {profileState.data ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Name:</span> {profileState.data.data.name}
                </p>
                <p>
                  <span className="font-medium">Path:</span> {profileState.data.data.path}
                </p>
                <p>
                  <span className="font-medium">Updated:</span>{" "}
                  {new Date(profileState.data.data.updatedAt).toLocaleString()}
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

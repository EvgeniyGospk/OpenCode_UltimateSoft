import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";

const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((m) => ({ default: m.DashboardPage }))
);
const AgentsPage = lazy(() =>
  import("@/pages/agents-page").then((m) => ({ default: m.AgentsPage }))
);
const ProvidersPage = lazy(() =>
  import("@/pages/providers-page").then((m) => ({ default: m.ProvidersPage }))
);
const JobsPage = lazy(() =>
  import("@/pages/jobs-page").then((m) => ({ default: m.JobsPage }))
);
const BackupsPage = lazy(() =>
  import("@/pages/backups-page").then((m) => ({ default: m.BackupsPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/settings-page").then((m) => ({ default: m.SettingsPage }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found-page").then((m) => ({ default: m.NotFoundPage }))
);

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "agents", element: <AgentsPage /> },
      { path: "providers", element: <ProvidersPage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "backups", element: <BackupsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);

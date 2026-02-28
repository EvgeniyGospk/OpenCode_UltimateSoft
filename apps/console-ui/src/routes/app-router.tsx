import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AgentsPage } from "@/pages/agents-page";
import { BackupsPage } from "@/pages/backups-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { JobsPage } from "@/pages/jobs-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProvidersPage } from "@/pages/providers-page";
import { SettingsPage } from "@/pages/settings-page";

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

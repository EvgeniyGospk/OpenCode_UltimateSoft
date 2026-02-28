import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Plug,
  Server
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const navItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Service and profile overview"
  },
  {
    to: "/agents",
    label: "Agents",
    icon: Bot,
    description: "Manage agent routes and model mapping"
  },
  {
    to: "/providers",
    label: "Providers",
    icon: Server,
    description: "Provider connection and config state"
  },
  {
    to: "/jobs",
    label: "Jobs",
    icon: ClipboardList,
    description: "Smoke jobs and execution logs"
  },
  {
    to: "/backups",
    label: "Backups",
    icon: Boxes,
    description: "Restore points and rollback operations"
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Plug,
    description: "Plugin, import/export, and runtime options"
  }
];

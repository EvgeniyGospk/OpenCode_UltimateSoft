import { Suspense, useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { navItems } from "@/routes/nav-items";
import { cn } from "@/lib/cn";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-panel)]/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Button
          size="icon"
          variant="ghost"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="shrink-0"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
          OpenCode
        </p>
        <p className="text-sm font-semibold">Console</p>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-49px)] w-full max-w-[1400px] grid-cols-1 gap-3 p-3 md:min-h-screen md:grid-cols-[260px_1fr] md:gap-4 md:p-4">
        {/* Sidebar */}
        <aside
          className={cn(
            "rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/90 p-3 shadow-sm backdrop-blur md:p-4",
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto"
              : "hidden md:flex md:flex-col"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] pb-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
                OpenCode
              </p>
              <p className="text-sm font-semibold">Local Console</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              aria-label="Close menu"
              onClick={closeSidebar}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="mt-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    cn(
                      "group rounded-lg px-3 py-2 transition-colors",
                      isActive
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                        : "text-[var(--color-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-ink)]"
                    )
                  }
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <p className="mt-1 pl-6 text-[11px] leading-snug text-[var(--color-muted)]">
                    {item.description}
                  </p>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <section className="min-w-0 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/90 p-3 shadow-sm backdrop-blur sm:p-4 md:p-6">
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-sm text-[var(--color-muted)]">Loading page...</p>
              </div>
            }>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </section>
      </div>
    </div>
  );
}

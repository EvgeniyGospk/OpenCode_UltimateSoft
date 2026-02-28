import { Menu } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { navItems } from "@/routes/nav-items";
import { cn } from "@/lib/cn";

export function AppShell() {
  const location = useLocation();
  const currentItem = navItems.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-[var(--color-line)] bg-white/90 p-3 shadow-sm backdrop-blur md:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] pb-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
                OpenCode
              </p>
              <p className="text-sm font-semibold">Local Console</p>
            </div>
            <Button size="icon" variant="ghost" className="md:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
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
                  className={({ isActive }) =>
                    cn(
                      "group rounded-lg px-3 py-2 transition-colors",
                      isActive
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                        : "text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)]"
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

        <section className="rounded-2xl border border-[var(--color-line)] bg-white/90 p-4 shadow-sm backdrop-blur md:p-6">
          <div className="mb-4 border-b border-[var(--color-line)] pb-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
              Current Section
            </p>
            <h2 className="text-lg font-semibold">{currentItem?.label ?? "OpenCode Console"}</h2>
          </div>
          <Outlet />
        </section>
      </div>
    </div>
  );
}

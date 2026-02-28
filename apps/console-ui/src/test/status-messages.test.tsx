import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusMessages } from "@/components/ui/status-messages";

describe("StatusMessages", () => {
  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  it("renders the default loading text when loading=true", () => {
    render(<StatusMessages loading />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders custom loading text", () => {
    render(<StatusMessages loading loadingText="Fetching data..." />);
    expect(screen.getByText("Fetching data...")).toBeInTheDocument();
  });

  it("does not render loading text when loading=false", () => {
    render(<StatusMessages loading={false} />);
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error
  // -------------------------------------------------------------------------

  it("renders the error message", () => {
    render(<StatusMessages error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the error with the danger color token class", () => {
    render(<StatusMessages error="fail" />);
    const errorEl = screen.getByText("fail");
    expect(errorEl.className).toContain("text-[var(--color-danger)]");
  });

  it("does not render error when error is null", () => {
    render(<StatusMessages error={null} />);
    // No error-styled text should be present
    const container = document.querySelector("[class*='color-danger']");
    expect(container).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Warning
  // -------------------------------------------------------------------------

  it("renders the warning message", () => {
    render(<StatusMessages warning="Be careful" />);
    expect(screen.getByText("Be careful")).toBeInTheDocument();
  });

  it("renders the warning with the warning color token class", () => {
    render(<StatusMessages warning="heads up" />);
    const warningEl = screen.getByText("heads up");
    expect(warningEl.className).toContain("text-[var(--color-warning)]");
  });

  it("does not render warning when warning is null", () => {
    render(<StatusMessages warning={null} />);
    const container = document.querySelector("[class*='color-warning']");
    expect(container).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("renders default empty text when isEmpty=true and not loading", () => {
    render(<StatusMessages isEmpty />);
    expect(screen.getByText("No items found.")).toBeInTheDocument();
  });

  it("renders custom empty text", () => {
    render(<StatusMessages isEmpty emptyText="Nothing here yet." />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("does NOT render empty text when loading=true (even if isEmpty)", () => {
    render(<StatusMessages loading isEmpty />);
    expect(screen.queryByText("No items found.")).not.toBeInTheDocument();
    // Loading text should be present instead
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("does not render empty text when isEmpty is false", () => {
    render(<StatusMessages isEmpty={false} />);
    expect(screen.queryByText("No items found.")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Combined states
  // -------------------------------------------------------------------------

  it("can show loading and error simultaneously", () => {
    render(<StatusMessages loading error="Error!" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getByText("Error!")).toBeInTheDocument();
  });

  it("renders nothing when all props are falsy", () => {
    const { container } = render(<StatusMessages />);
    expect(container.textContent).toBe("");
  });

  // -------------------------------------------------------------------------
  // hasData — suppress loading when data already present
  // -------------------------------------------------------------------------

  it("does NOT show loading text when hasData=true (background refresh)", () => {
    render(<StatusMessages loading hasData loadingText="Loading items..." />);
    expect(screen.queryByText("Loading items...")).not.toBeInTheDocument();
  });

  it("shows loading text when hasData=false", () => {
    render(<StatusMessages loading hasData={false} loadingText="Loading items..." />);
    expect(screen.getByText("Loading items...")).toBeInTheDocument();
  });
});

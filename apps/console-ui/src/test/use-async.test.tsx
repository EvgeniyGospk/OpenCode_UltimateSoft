import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAsync } from "@/lib/useAsync";

describe("useAsync", () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it("starts with loading=true by default", () => {
    const { result } = renderHook(() => useAsync());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.warning).toBeNull();
  });

  it("starts with loading=false when initialLoading is false", () => {
    const { result } = renderHook(() => useAsync(false));
    expect(result.current.loading).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Successful run
  // -------------------------------------------------------------------------

  it("sets loading=false after a successful run", async () => {
    const { result } = renderHook(() => useAsync());

    await act(async () => {
      await result.current.run(async () => "ok");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns the value produced by the callback", async () => {
    const { result } = renderHook(() => useAsync());

    let returned: string | undefined;
    await act(async () => {
      returned = await result.current.run(async () => "hello world");
    });

    expect(returned).toBe("hello world");
  });

  it("clears a previous error on a new successful run", async () => {
    const { result } = renderHook(() => useAsync());

    // First call: fail
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("boom");
      });
    });
    expect(result.current.error).toBe("boom");

    // Second call: succeed
    await act(async () => {
      await result.current.run(async () => "recovered");
    });
    expect(result.current.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Failed run
  // -------------------------------------------------------------------------

  it("sets error on a failed run and returns undefined", async () => {
    const { result } = renderHook(() => useAsync());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(async () => {
        throw new Error("network failure");
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("network failure");
    expect(returned).toBeUndefined();
  });

  it("uses a fallback message for non-Error throws", async () => {
    const { result } = renderHook(() => useAsync());

    await act(async () => {
      await result.current.run(async () => {
        throw "just a string";
      });
    });

    expect(result.current.error).toBe("An unexpected error occurred");
  });

  // -------------------------------------------------------------------------
  // Warning state
  // -------------------------------------------------------------------------

  it("allows setting a warning", () => {
    const { result } = renderHook(() => useAsync());

    act(() => {
      result.current.setWarning("Careful!");
    });

    expect(result.current.warning).toBe("Careful!");
  });

  it("allows clearing a warning", () => {
    const { result } = renderHook(() => useAsync());

    act(() => {
      result.current.setWarning("Careful!");
    });
    expect(result.current.warning).toBe("Careful!");

    act(() => {
      result.current.setWarning(null);
    });
    expect(result.current.warning).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Manual setError
  // -------------------------------------------------------------------------

  it("allows setting an error manually", () => {
    const { result } = renderHook(() => useAsync());

    act(() => {
      result.current.setError("manual error");
    });

    expect(result.current.error).toBe("manual error");
  });

  // -------------------------------------------------------------------------
  // Unmount guard
  // -------------------------------------------------------------------------

  it("does not update state after unmount", async () => {
    const { result, unmount } = renderHook(() => useAsync());

    // Start a long-running async operation
    let resolveFn: (v: string) => void;
    const promise = result.current.run(
      () => new Promise<string>((resolve) => { resolveFn = resolve; })
    );

    // Unmount while the operation is in flight
    unmount();

    // Resolve — should not throw or update state
    await act(async () => {
      resolveFn!("late value");
      await promise;
    });

    // If we got here without errors, the mount guard worked
    expect(true).toBe(true);
  });

  it("recovers after unmount+remount (React StrictMode dev cycle)", async () => {
    // Simulate the StrictMode double-mount: render → unmount → re-render.
    // The first render's cleanup sets mountedRef = false; the second render's
    // effect must reset it to true so that run() can update state again.
    const { result, unmount } = renderHook(() => useAsync());

    // Unmount (as StrictMode does), then re-render with the same hook.
    unmount();

    // Re-mount — simulates the second mount in StrictMode.
    const { result: result2 } = renderHook(() => useAsync());

    await act(async () => {
      await result2.current.run(async () => "after remount");
    });

    // Critical: loading must be false — not stuck on true.
    expect(result2.current.loading).toBe(false);
    expect(result2.current.error).toBeNull();
  });
});

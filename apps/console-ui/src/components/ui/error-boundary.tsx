import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <h2 className="text-lg font-semibold text-[var(--color-danger)]">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              {this.state.error?.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

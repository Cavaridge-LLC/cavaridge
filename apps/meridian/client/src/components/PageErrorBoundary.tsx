import * as Sentry from "@sentry/react";
import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[PageErrorBoundary] ${this.props.pageName || "Page"} crashed:`, error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack, pageName: this.props.pageName } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8" data-testid="error-boundary-fallback">
        <div className="max-w-md w-full rounded-xl border border-red-500/20 bg-[var(--bg-secondary)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {this.props.pageName
              ? `The ${this.props.pageName} page encountered an error.`
              : "This section encountered an error."}
          </p>
          {this.state.error && (
            <pre className="mb-4 rounded-lg bg-[var(--bg-primary)] p-3 text-left text-xs text-red-400 overflow-auto max-h-32 font-mono">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            data-testid="button-error-retry"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }
}

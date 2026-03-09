import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center p-8 text-center"
          data-testid="error-boundary-fallback"
        >
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2" data-testid="error-boundary-title">
            {this.props.fallbackTitle || "Something went wrong"}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4" data-testid="error-boundary-message">
            {this.props.fallbackMessage || "An unexpected error occurred in this section. Other parts of the app should still work."}
          </p>
          {this.state.error && (
            <details className="text-xs text-slate-400 mb-4 max-w-md">
              <summary className="cursor-pointer hover:text-slate-600">Error details</summary>
              <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            data-testid="btn-error-retry"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

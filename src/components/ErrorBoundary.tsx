import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label ?? "route", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded-xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-center gap-2 text-red-600 font-semibold">
          <AlertTriangle className="size-4" /> Something went wrong
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {this.state.error.message || "An unexpected error occurred while rendering this page."}
        </p>
        <button
          onClick={this.reset}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
        >
          <RotateCcw className="size-3.5" /> Try again
        </button>
      </div>
    );
  }
}

"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag("errorBoundary", "true");
      scope.setContext("componentStack", {
        stack: errorInfo.componentStack,
      });
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-orange-50">
            <div className="text-center p-8 max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Something went wrong 😕
              </h2>
              <p className="text-gray-600 mb-6">
                We have been notified and are working on a fix.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}


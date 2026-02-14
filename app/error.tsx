"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Oops! Something went wrong
        </h2>
        <p className="text-gray-600 mb-2">
          {error.message || "An unexpected error occurred"}
        </p>
        {error.digest && (
          <p className="text-sm text-gray-400 mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}


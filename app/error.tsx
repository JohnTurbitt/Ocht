"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        pathname: window.location.pathname,
      }),
    }).catch(() => {
      // Reporting failures must never break the error UI.
    });
  }, [error]);

  return (
    <main className="not-found error-page">
      <p className="eyebrow">Ocht</p>
      <h1>Something went wrong</h1>
      <p>
        That page hit an unexpected error. You can try again, or head back to
        the dashboard.
      </p>
      <div className="error-page__actions">
        <button type="button" className="btn btn--primary" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn btn--secondary" href="/">
          Back to Ocht
        </Link>
      </div>
    </main>
  );
}

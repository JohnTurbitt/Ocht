"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          alignContent: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 48,
          background: "#0e1914",
          color: "#f4f7ef",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div>
          <p style={{ color: "#9fb39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Ocht
          </p>
          <h1 style={{ fontSize: "2.4rem", margin: "8px 0 16px" }}>Something went wrong</h1>
          <p style={{ color: "#9fb39a", marginBottom: 24 }}>
            The app hit an unexpected error. Try reloading the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#c8ff2e",
              color: "#11160f",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

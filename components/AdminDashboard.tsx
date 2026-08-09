"use client";

import { FormEvent, useState } from "react";
import { AdminUserSummary, searchAdminUsers } from "@/lib/adminApiClient";
import { AdminUserDetail } from "@/components/AdminUserDetail";

export function AdminDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  function handleSearch(event: FormEvent) {
    event.preventDefault();

    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setError(null);

    searchAdminUsers(query.trim())
      .then((users) => {
        setResults(users);
        setSearched(true);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setSearching(false);
      });
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <span className="admin-topbar__title">Admin</span>
      </div>
      <div className="admin-layout">
        <div className="admin-sidebar">
          <form onSubmit={handleSearch}>
            <input
              className="admin-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email or cus_..."
            />
          </form>
          {error && <p className="admin-error">{error}</p>}
          {searching ? (
            <p className="admin-empty">Searching…</p>
          ) : results.length > 0 ? (
            <div className="admin-results">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={user.id === selectedUserId ? "admin-result is-selected" : "admin-result"}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <span className="admin-result__email">{user.email}</span>
                  <span className="admin-result__meta">
                    {user.name ?? "—"}
                    {user.stripeCustomerId ? ` · ${user.stripeCustomerId}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : searched ? (
            <p className="admin-empty">No results.</p>
          ) : null}
        </div>
        <div>
          {selectedUserId ? (
            <AdminUserDetail userId={selectedUserId} />
          ) : (
            <p className="admin-empty">Select a user from the search results.</p>
          )}
        </div>
      </div>
    </div>
  );
}

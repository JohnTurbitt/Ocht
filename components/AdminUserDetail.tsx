"use client";

import { useEffect, useState } from "react";
import {
  AdminOverrideAction,
  AdminUserDetail as AdminUserDetailData,
  getAdminUserDetail,
  submitAdminOverride,
} from "@/lib/adminApiClient";

type Props = {
  userId: string;
};

const subscriptionLabels: Record<AdminUserDetailData["subscription"], string> = {
  ACTIVE: "Active",
  CANCELED: "Canceled",
  FREE: "Free",
  PAST_DUE: "Past due",
};

const overrideLabels: Record<"COMP" | "DISABLED", string> = {
  COMP: "Comp override",
  DISABLED: "Disabled override",
};

export function AdminUserDetail({ userId }: Props) {
  const [detail, setDetail] = useState<AdminUserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState<AdminOverrideAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReason("");

    getAdminUserDetail(userId)
      .then((user) => {
        if (!cancelled) {
          setDetail(user);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function handleAction(action: AdminOverrideAction) {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setSubmittingAction(action);
    setError(null);

    submitAdminOverride(userId, { action, reason: reason.trim() })
      .then((user) => {
        setDetail(user);
        setReason("");
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setSubmittingAction(null);
      });
  }

  if (loading) {
    return <p className="admin-empty">Loading…</p>;
  }

  if (!detail) {
    return <p className="admin-error">{error ?? "User not found."}</p>;
  }

  return (
    <div className="admin-detail">
      <div className="admin-detail__head">
        <div>
          <div className="admin-detail__name">{detail.name ?? detail.email}</div>
          <div className="admin-detail__meta">
            {detail.email} · joined {new Date(detail.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div>
          <span
            className={
              detail.stripeSubscription === "ACTIVE"
                ? "admin-pill admin-pill--active"
                : "admin-pill"
            }
          >
            Stripe: {subscriptionLabels[detail.stripeSubscription]}
          </span>{" "}
          <span
            className={
              detail.subscriptionOverride ? "admin-pill admin-pill--override" : "admin-pill"
            }
          >
            {detail.subscriptionOverride ? overrideLabels[detail.subscriptionOverride] : "No override"}
          </span>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-card">
        <div className="admin-card__title">Account</div>
        <div className="admin-row">
          <span className="admin-row__label">Email verified</span>
          <span>{detail.emailVerified ? "Yes" : "No"}</span>
        </div>
        <div className="admin-row">
          <span className="admin-row__label">Onboarding</span>
          <span>{detail.onboardingCompleted ? "Completed" : "Incomplete"}</span>
        </div>
        <div className="admin-row">
          <span className="admin-row__label">Strava</span>
          <span>
            {detail.strava
              ? detail.strava.revoked
                ? "Revoked"
                : `Connected · ${new Date(detail.strava.connectedAt as string).toLocaleDateString()}`
              : "Not connected"}
          </span>
        </div>
        <div className="admin-row">
          <span className="admin-row__label">Reports</span>
          <span>
            {detail.reportCount}
            {detail.lastReportAt ? ` · last ${new Date(detail.lastReportAt).toLocaleDateString()}` : ""}
          </span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__title">Subscription override</div>
        <div className="admin-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={submittingAction !== null}
            onClick={() => handleAction("GRANT_COMP")}
          >
            Grant comp access
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={submittingAction !== null}
            onClick={() => handleAction("DISABLE")}
          >
            Disable access
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={submittingAction !== null || !detail.subscriptionOverride}
            onClick={() => handleAction("CLEAR_OVERRIDE")}
          >
            Clear override
          </button>
        </div>
        <label className="admin-reason-label">
          <span className="admin-row__label">Reason (required)</span>
          <textarea
            className="admin-reason-input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Why are you making this change?"
          />
        </label>
      </div>

      <div className="admin-card">
        <div className="admin-card__title">Admin action history</div>
        {detail.actions.length === 0 ? (
          <p className="admin-empty">No admin actions yet.</p>
        ) : (
          <div className="admin-audit-list">
            {detail.actions.map((entry) => (
              <div key={entry.id} className="admin-audit-item">
                <strong>{new Date(entry.createdAt).toLocaleDateString()}</strong> — {entry.adminEmail}{" "}
                {entry.action === "GRANT_COMP" && "granted COMP"}
                {entry.action === "DISABLE" && "disabled access"}
                {entry.action === "CLEAR_OVERRIDE" && "cleared the override"}
                {" · "}
                {entry.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

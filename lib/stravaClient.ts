import { getValidAccessToken } from "./stravaTokens";
import type { StravaActivity, StravaAthlete } from "./stravaTypes";

const BASE = "https://www.strava.com/api/v3";

async function stravaFetch(userId: string, path: string): Promise<Response> {
  const token = await getValidAccessToken(userId);
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAthlete(userId: string): Promise<StravaAthlete> {
  const res = await stravaFetch(userId, "/athlete");
  if (!res.ok) throw new Error(`Strava athlete fetch failed: ${res.status}`);
  return res.json();
}

export async function getActivities(
  userId: string,
  opts: { perPage: number; after: number },
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(opts.perPage),
    after: String(opts.after),
  });
  const res = await stravaFetch(userId, `/athlete/activities?${params}`);
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`);
  return res.json();
}

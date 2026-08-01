// Split out from lib/session.ts so this single constant can be imported
// without pulling in node:crypto — safe for the Edge middleware runtime.
export const sessionCookieName = "ocht_session";

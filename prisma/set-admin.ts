// One-off script to grant or revoke admin access for a user by email.
// Run from the repo root: npx tsx prisma/set-admin.ts you@example.com
// Add --revoke to remove admin access instead: npx tsx prisma/set-admin.ts you@example.com --revoke
//
// This uses whichever DATABASE_URL is active in your environment. Run it once
// per database you want affected — locally against your dev database, and
// again with the production DATABASE_URL set (e.g. via `vercel env pull`)
// when you want admin access in production. There is no in-app way to grant
// admin access; this script is the only path, by design.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// `.env` is saved UTF-8 with a BOM, which process.loadEnvFile does not strip
// (see prisma.config.ts and prisma/seed-dev.ts for the same gotcha).
function loadEnvFile(path: string) {
  const envPath = join(process.cwd(), path);
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf8");
  const contents = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env");

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: npx tsx prisma/set-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const { prisma } = await import("../lib/prisma");
  const { normalizeEmail } = await import("../lib/auth");

  const user = await prisma.user.update({
    where: { email: normalizeEmail(email) },
    data: { isAdmin: !revoke },
  });

  console.log(`${revoke ? "Revoked" : "Granted"} admin access for ${user.email}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

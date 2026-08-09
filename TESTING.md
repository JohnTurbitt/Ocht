# Ocht Preview Setup

## Local Setup

Ocht's database is **Neon Postgres** (cloud) in both dev and prod — there's
no local Docker container. From the project folder:

```powershell
cd c:\Users\johnt\Documents\ocht
npm install
```

Copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection
string (see the README's [Environment Variables](./README.md#environment-variables)
section). Save `.env` as plain UTF-8 without a BOM — a BOM breaks the Prisma
CLI's env reader even though `next dev` still works.

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open:

```text
http://127.0.0.1:3002
```

To browse with realistic data instead of a blank account, seed the four dev
accounts described in the README's
[Local Dev Seed Accounts](./README.md#local-dev-seed-accounts) section.

## What To Try

1. Generate a report while signed out.
2. Confirm it appears under Previous reports and survives a refresh in the same browser.
3. Create an account from the panel near the top of the app.
4. Generate another report while signed in.
5. Confirm Previous reports says it is saved to the account.
6. Log out and confirm the app returns to browser-only history.
7. Log back in and confirm the account report history returns.
8. Load a saved report and confirm the splits populate the report form.
9. Delete a saved account report and confirm it disappears.
10. Grant yourself admin (`npx tsx prisma/set-admin.ts you@example.com`), open
    `/admin`, search for a user, and confirm the detail view and override
    action work.

## Verification Commands

Before sharing the app for someone to play around with:

```powershell
npm test
npm run build
```

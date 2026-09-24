// Runs the database migrations at build time.
//
// Exists instead of calling `prisma migrate deploy` directly for two reasons:
//
//   1. Prisma's error when DATABASE_URL is missing is a wall of schema
//      validation output that says nothing about what to actually do. This
//      prints the fix instead.
//   2. DIRECT_URL falls back to DATABASE_URL. Migrations want an unpooled
//      connection, but requiring two variables when most people have one is
//      a needless way to fail a deploy.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Locally the connection string lives in .env; on Vercel it comes from the
// platform. The Prisma CLI reads .env by itself, plain Node doesn't, so load
// it here or `npm run setup` fails on a machine that's set up correctly.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env — normal on Vercel, and on a first run before it's created.
}

const line = "─".repeat(68);

function fail(message) {
  console.error(`\n${line}\n  CAN'T REACH A DATABASE\n${line}\n`);
  console.error(message.trim());
  console.error(`\n${line}\n`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  fail(`
  DATABASE_URL isn't set, so there's nowhere to create the tables.

  In your Vercel project:

    1. Storage  ->  Create Database  ->  Neon (Postgres)
    2. Connect it to this project
    3. Settings -> Environment Variables: check DATABASE_URL is there
    4. Deployments -> latest -> ... -> Redeploy

  Step 4 matters: environment variables are only read at build time, so a
  deploy from before you added them won't pick them up.

  Full walkthrough: DEPLOY.md in this repo.`);
}

if (databaseUrl.startsWith("file:")) {
  fail(`
  DATABASE_URL points at a SQLite file:

    ${databaseUrl}

  This app runs on Postgres. A serverless host has no disk that survives a
  deploy, so a database file would be wiped every time you shipped.

  Create a Neon database (Vercel: Storage -> Create Database) and use the
  connection string it gives you, which starts with postgresql://`);
}

// Migrations need an unpooled connection — poolers reject the statements they
// run. Use DIRECT_URL when it's there, otherwise the pooled one works fine at
// the volumes this app sees.
const directUrl = process.env.DIRECT_URL?.trim() || databaseUrl;

if (!process.env.DIRECT_URL?.trim()) {
  console.log(
    "No DIRECT_URL set — using DATABASE_URL for migrations. Fine to start " +
      "with; set DIRECT_URL to the unpooled connection string if migrations " +
      "ever hang.",
  );
}

console.log("Applying database migrations…");

// Run Prisma's entry point with the current node rather than relying on
// `prisma` being on PATH — it only is inside an npm script, so calling this
// file directly would otherwise fail with a confusing ENOENT.
const prismaEntry = fileURLToPath(
  import.meta.resolve("prisma/build/index.js"),
);

const result = spawnSync(process.execPath, [prismaEntry, "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DIRECT_URL: directUrl },
});

if (result.error) {
  fail(`  Couldn't run Prisma: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(`
  The migrations failed to apply.

  Most likely causes, in order:

    - The connection string is wrong, or is for a database that no longer
      exists. Check Settings -> Environment Variables in Vercel.
    - It's set for Preview but not Production (or the other way round).
    - The database is paused. Neon's free tier sleeps; opening it in the
      Neon dashboard wakes it up.

  The Prisma output above this message says which.`);
}

console.log("Database is ready.");

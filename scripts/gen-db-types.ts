import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Regenerates src/generated/supabase/database.types.ts from the live DB schema.
 * Committed (not gitignored): unlike Prisma's client, this can't be rebuilt
 * without DB access, so a clean checkout / CI build needs the file present.
 *
 * Run after every Prisma migration: npm run db:types
 */
const OUT_FILE = "src/generated/supabase/database.types.ts";

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("DIRECT_URL is not set (expected in .env)");
  process.exit(1);
}

const raw = execFileSync(
  "npx",
  ["--yes", "supabase@latest", "gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 16 * 1024 * 1024 }
);

// The CLI prints progress/hint lines to stdout ahead of the actual types.
const start = raw.indexOf("export type Json");
if (start === -1) {
  console.error("Unexpected CLI output — no `export type Json` found");
  process.exit(1);
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, raw.slice(start));
execFileSync("npx", ["--yes", "oxfmt", OUT_FILE], { stdio: "inherit" });

console.log(`Wrote ${OUT_FILE}`);

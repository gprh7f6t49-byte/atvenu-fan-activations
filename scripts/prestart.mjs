// Runs before `next start` in production.
import { execSync } from "node:child_process";
import path from "node:path";

const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
const message = process.env.RAILWAY_GIT_COMMIT_MESSAGE?.split("\n")[0];
console.log(`Activations version ${version}${message ? ` — ${message}` : ""}`);

// Warn loudly if the database isn't on a Railway volume (data would be lost on every deploy).
const dbPath = path.resolve(process.env.DATABASE_PATH ?? "data/activations.db");
const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (process.env.RAILWAY_PROJECT_ID) {
  if (!volume) console.warn("WARNING: no Railway volume attached — the database will be wiped on every deploy.");
  else if (!dbPath.startsWith(path.resolve(volume) + path.sep)) console.warn(`WARNING: DATABASE_PATH (${dbPath}) is not on the volume (${volume}).`);
  else console.log(`Database: ${dbPath} (on volume ${volume})`);
}

// With SEED_DEMO=true, load the Oasis demo data (the seed skips anything that already exists).
if (process.env.SEED_DEMO === "true") {
  execSync("npx tsx scripts/seed.ts --demo", { stdio: "inherit" });
}

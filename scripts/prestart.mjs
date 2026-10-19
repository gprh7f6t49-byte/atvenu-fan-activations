// Runs before `next start` in production. With SEED_DEMO=true it loads the Oasis demo
// data the first time (the seed skips anything that already exists, so restarts are safe).
import { execSync } from "node:child_process";

if (process.env.SEED_DEMO === "true") {
  execSync("npx tsx scripts/seed.ts --demo", { stdio: "inherit" });
}

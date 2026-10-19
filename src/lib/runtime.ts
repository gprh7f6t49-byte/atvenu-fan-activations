import path from "node:path";
import { DB_PATH } from "./db";

/** Short commit id of the running build (Railway sets RAILWAY_GIT_COMMIT_SHA), or "dev" locally. */
export const appVersion = (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.APP_VERSION ?? "dev").slice(0, 7);

/**
 * On Railway, the database must live on a mounted volume or every deploy starts from an empty
 * database. Returns a warning to show atVenu admins when that isn't the case.
 */
export function storageWarning(): string | null {
  const onRailway = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME);
  if (!onRailway) return null;
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (!volume) return "No persistent volume is attached, so all data is wiped on every deploy. In Railway, add a Volume mounted at /data and set DATABASE_PATH=/data/activations.db.";
  const db = path.resolve(DB_PATH);
  if (!db.startsWith(path.resolve(volume) + path.sep)) {
    return `The database (${db}) isn't on the volume mounted at ${volume}, so data is wiped on every deploy. Set DATABASE_PATH=${path.posix.join(volume, "activations.db")} in Railway.`;
  }
  return null;
}

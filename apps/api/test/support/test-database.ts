import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPrisma } from "../../src/common/database/prisma.ts";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://pontinho:pontinho@localhost:54329/pontinho_test";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const API_ROOT = fileURLToPath(new URL("../..", import.meta.url));

if (!LOCAL_HOSTS.includes(new URL(TEST_DATABASE_URL).hostname)) {
  throw new Error("TEST_DATABASE_URL must point to a local database: the tests truncate every table");
}

export const testPrisma = createPrisma({ databaseUrl: TEST_DATABASE_URL });

let migrated = false;

export function migrateTestDatabase(): void {
  if (migrated) {
    return;
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
  migrated = true;
}

export async function resetDatabase(): Promise<void> {
  await testPrisma.$executeRawUnsafe(
    "TRUNCATE TABLE wallet_entries, match_players, matches, purchases, users RESTART IDENTITY CASCADE",
  );
}

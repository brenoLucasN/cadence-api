import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { config } from "../config";
import * as schema from "./schema";

const migrationsFolder = `${import.meta.dir}/../../drizzle`;

export let migrationPromise: Promise<void> | null = null;

const createDbSync = () => {
  if (config.usePglite) {
    const client = new PGlite();
    const dbInstance = drizzlePglite(client, { schema });
    
    // Run migration in background to avoid top-level await blocking module initialization
    migrationPromise = migratePglite(dbInstance, { migrationsFolder }).catch((err) => {
      console.error("PGlite migration failed:", err);
      throw err;
    });
    
    return dbInstance;
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.isProduction ? 5 : 2,
  });
  const dbInstance = drizzleNodePg(pool, { schema });
  
  if (!config.isProduction) {
    // Run migration in background to avoid top-level await blocking module initialization
    migrationPromise = migrateNodePg(dbInstance, { migrationsFolder }).catch((err) => {
      console.error("Local migration failed:", err);
      throw err;
    });
  }
  
  return dbInstance;
};

export const db = createDbSync();

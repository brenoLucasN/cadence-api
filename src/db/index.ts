import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { config } from "../config";
import * as schema from "./schema";

const migrationsFolder = `${import.meta.dir}/../../drizzle`;

const createDb = async () => {
  if (config.usePglite) {
    const client = new PGlite();
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder });
    return db;
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.isProduction ? 5 : 2,
  });
  const db = drizzleNodePg(pool, { schema });
  if (!config.isProduction) {
    await migrateNodePg(db, { migrationsFolder });
  }
  return db;
};

export const db = await createDb();

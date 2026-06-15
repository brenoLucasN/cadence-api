import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { config } from "../config";
import * as schema from "./schema";

const runMigration = async () => {
  if (!config.databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });
  const db = drizzle(pool, { schema });

  console.log("Running migrations...");
  const migrationsFolder = `${import.meta.dir}/../../drizzle`;
  
  try {
    await migrate(db, { migrationsFolder });
    console.log("Migrations successfully applied!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

runMigration();

import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs, { type Database } from "sql.js";
import * as schema from "./schema";

let databasePromise: Promise<Database> | undefined;

async function getDatabase() {
  databasePromise ??= initSqlJs().then((SQL) => new SQL.Database());
  return databasePromise;
}

export async function getLocalDb() {
  const database = await getDatabase();
  return drizzle(database, { schema });
}

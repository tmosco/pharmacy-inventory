
import Database from "@tauri-apps/plugin-sql";

// Name of your local SQLite database
const DATABASE_URL = "sqlite:pharmacy.db";

// Shared promise for loading the database
let databasePromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (databasePromise === null) {
    databasePromise = Database.load(DATABASE_URL).catch(
      (error) => {
        // Allow retrying if the first connection fails
        databasePromise = null;
        throw error;
      }
    );
  }

  return databasePromise;
}

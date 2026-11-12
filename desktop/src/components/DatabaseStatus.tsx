
import { useState } from "react";
import { getDb } from "../data/db";

interface DatabaseLocation {
  seq: number;
  name: string;
  file: string;
}

export function DatabaseStatus() {
  const [status, setStatus] = useState("Not tested");
  const [databasePath, setDatabasePath] = useState("");

  async function testConnection() {
    setStatus("Connecting...");

    try {
      const db = await getDb();

      // Basic connection test
      const result = await db.select<
        { result: number }[]
      >("SELECT 1 AS result");

      if (result[0]?.result !== 1) {
        throw new Error("Unexpected SELECT result");
      }

      // Find the actual database location
      const locations = await db.select<
        DatabaseLocation[]
      >("PRAGMA database_list");

      const main = locations.find(
        (location) => location.name === "main"
      );

      setDatabasePath(main?.file ?? "Path unavailable");

      // Inspect database settings
      console.table(
        await db.select("PRAGMA foreign_keys")
      );

      console.table(
        await db.select("PRAGMA journal_mode")
      );

      console.table(
        await db.select("PRAGMA busy_timeout")
      );

      console.table(
        await db.select(
          "SELECT sqlite_version() AS version"
        )
      );

      setStatus("Connected successfully");
    } catch (error) {
      console.error("SQLite connection failed:", error);
      setStatus("Connection failed. Check console.");
    }
  }

  return (
    <section>
      <h2>SQLite connection test</h2>

      <button type="button" onClick={testConnection}>
        Test database
      </button>

      <p>Status: {status}</p>

      {databasePath && (
        <p>
          Database location: <code>{databasePath}</code>
        </p>
      )}
    </section>
  );
}

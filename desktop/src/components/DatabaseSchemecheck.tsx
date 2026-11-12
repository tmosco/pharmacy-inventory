
import { useState } from "react";
import { getDb } from "../data/db";

interface TableRow {
  name: string;
}

interface ColumnRow {
  name: string;
  type: string;
}

export function DatabaseSchemaCheck() {
  const [message, setMessage] = useState("Not checked");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function verifyDatabase() {
    setLoading(true);
    setMessage("Checking database...");
    setTables([]);
    setColumns([]);

    try {
      // 1. Connect to SQLite
      const db = await getDb();

      // 2. Get all database tables
      const tableResults = await db.select<TableRow[]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );

      // 3. Get the Products table columns
      const columnResults = await db.select<ColumnRow[]>(
        "PRAGMA table_info(products)"
      );

      // 4. Show results in the developer console
      console.table(tableResults);
      console.table(columnResults);

      // 5. Display results on the screen
      setTables(tableResults);
      setColumns(columnResults);

      if (
        tableResults.some(
          (table) => table.name === "products"
        )
      ) {
        setMessage("Products table exists!");
      } else {
        setMessage("Products table was not found.");
      }
    } catch (error) {
      console.error("Database verification failed:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to check the database."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ padding: "20px" }}>
      <h2>Database Verification</h2>

      <button
        type="button"
        onClick={verifyDatabase}
        disabled={loading}
      >
        {loading ? "Checking..." : "Verify Database"}
      </button>

      <p role="status">{message}</p>

      <h3>Database Tables</h3>
      <ul>
        {tables.map((table) => (
          <li key={table.name}>{table.name}</li>
        ))}
      </ul>

      <h3>Products Table Columns</h3>
      <ul>
        {columns.map((column) => (
          <li key={column.name}>
            {column.name} ({column.type})
          </li>
        ))}
      </ul>
    </section>
  );
}

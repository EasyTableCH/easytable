import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.NODE_ENV === "test" && process.env.LOCAL_MASTER_DB_PATH
      ? process.env.LOCAL_MASTER_DB_PATH
      : resolve(process.env.ProgramData?.trim() || "C:\\ProgramData", "EasyTable", "LocalMaster", "local-master.sqlite3")
  }
});

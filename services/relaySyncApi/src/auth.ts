import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { getDrizzleDatabase } from "./db/client.js";
import * as schema from "./db/schema.js";

const db = getDrizzleDatabase();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  baseURL: process.env.RELAY_PUBLIC_BASE_URL || "http://localhost:3100",
  trustedOrigins: [
    "http://localhost:1422",
    "http://localhost:1424",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "tauri://localhost",
    "http://tauri.localhost",
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "INVITED",
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
});

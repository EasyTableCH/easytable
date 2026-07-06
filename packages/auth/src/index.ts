import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_RELAY_SYNC_URL || "http://localhost:3100",
});

export const { signIn, signUp, useSession, signOut } = authClient;

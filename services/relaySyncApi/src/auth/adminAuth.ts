import type { FastifyRequest } from "fastify";

import { ApiError } from "../store/errors.js";

export function requireAdminToken(request: FastifyRequest) {
  const configuredToken = process.env.RELAY_ADMIN_TOKEN?.trim();

  if (!configuredToken) {
    throw new ApiError("RELAY_ADMIN_TOKEN is required for admin routes.", 500);
  }

  const authorization = request.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";

  if (token !== configuredToken) {
    throw new ApiError("Admin token is required.", 401);
  }
}

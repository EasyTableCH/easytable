import type { FastifyInstance } from "fastify";
import { ApiError } from "../store/errors.js";

type ReleaseManifest = {
  product: "localMaster" | "pos-shell";
  channel: "stable" | "beta";
  version: string;
  url: string;
  sha256: string;
  signature: string;
  published_at: string;
  api_version: number;
  minimum_client_api_version: number;
  maximum_client_api_version: number;
};

export async function registerReleaseRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { product?: string; channel?: string } }>("/api/releases/manifest", async (request) => {
    const manifests = loadReleaseManifests();
    const product = request.query.product;
    const channel = request.query.channel ?? "stable";
    const manifest = manifests.find((candidate) => candidate.product === product && candidate.channel === channel);
    if (!manifest) throw new ApiError("Release manifest is not configured.", 404);
    return manifest;
  });
}

function loadReleaseManifests(): ReleaseManifest[] {
  const raw = process.env.EASYTABLE_RELEASE_MANIFEST_JSON;
  if (!raw) return [];
  const parsed = JSON.parse(raw) as ReleaseManifest[];
  return parsed.filter((manifest) => manifest.url.startsWith("https://") && Boolean(manifest.sha256) && Boolean(manifest.signature));
}

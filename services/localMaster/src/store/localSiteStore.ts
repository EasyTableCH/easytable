import { eq } from "drizzle-orm";

import { getDrizzleDatabase } from "../db/client.js";
import { localState } from "../db/schema.js";
import type { LocalMasterBootstrap, LocationServiceMode } from "../types.js";
import { location as seedLocation, tenant as seedTenant } from "./storeSeeds.js";

const localSiteConfigKey = "localMaster.localSiteConfig";

export type LocalSiteConfig = {
  tenant: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    tenant_id: string;
    name: string;
  };
  service_mode: LocationServiceMode;
  bootstrapped_at: string | null;
  updated_at: string;
};

export function loadLocalSiteConfig(): LocalSiteConfig {
  const stored = readLocalSiteConfig();
  if (stored) {
    return stored;
  }

  const now = new Date(0).toISOString();
  return {
    tenant: { id: seedTenant.id, name: seedTenant.name },
    location: { id: seedLocation.id, tenant_id: seedLocation.tenant_id, name: seedLocation.name },
    service_mode: "TABLE_SERVICE",
    bootstrapped_at: null,
    updated_at: now
  };
}

export function saveLocalSiteConfigFromBootstrap(bootstrap: LocalMasterBootstrap): LocalSiteConfig {
  const now = new Date().toISOString();
  const config: LocalSiteConfig = {
    tenant: {
      id: bootstrap.tenant.id,
      name: bootstrap.tenant.name
    },
    location: {
      id: bootstrap.location.id,
      tenant_id: bootstrap.location.tenant_id,
      name: bootstrap.location.name
    },
    service_mode: bootstrap.service_mode,
    bootstrapped_at: bootstrap.bootstrapped_at,
    updated_at: now
  };

  writeLocalSiteConfig(config);
  return config;
}

export function readLocalSiteConfig(): LocalSiteConfig | null {
  const row = getDrizzleDatabase()
    .select({ valueJson: localState.valueJson })
    .from(localState)
    .where(eq(localState.key, localSiteConfigKey))
    .get();

  if (!row) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.valueJson) as Partial<LocalSiteConfig>;
    if (!parsed.tenant?.id || !parsed.location?.id || !parsed.service_mode) {
      return null;
    }

    return {
      tenant: {
        id: parsed.tenant.id,
        name: parsed.tenant.name ?? parsed.tenant.id
      },
      location: {
        id: parsed.location.id,
        tenant_id: parsed.location.tenant_id ?? parsed.tenant.id,
        name: parsed.location.name ?? parsed.location.id
      },
      service_mode: parsed.service_mode,
      bootstrapped_at: parsed.bootstrapped_at ?? null,
      updated_at: parsed.updated_at ?? new Date(0).toISOString()
    };
  } catch {
    return null;
  }
}

function writeLocalSiteConfig(config: LocalSiteConfig) {
  getDrizzleDatabase()
    .insert(localState)
    .values({ key: localSiteConfigKey, valueJson: JSON.stringify(config), updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: localState.key,
      set: { valueJson: JSON.stringify(config), updatedAt: Date.now() }
    })
    .run();
}

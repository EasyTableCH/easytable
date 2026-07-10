import { location, tenant } from "./storeSeeds.js";
import { loadLocalSiteConfig } from "./localSiteStore.js";
import type { PosSettingsFile } from "../types.js";
import { getWalleeConfigStatus } from "./walleeConfigStore.js";

const posSettings: PosSettingsFile = {
  path: "local-master://settings/pos-settings.json",
  settings: {
    schema_version: 1,
    tenant_id: tenant.id,
    location_id: location.id,
    service_mode: "TABLE_SERVICE",
    language: "de-CH",
    business_day_cutover_time: "00:00",
    receipt_printer: {
      enabled: false,
      provider: "none",
      device_id: null
    },
    payment_terminal: {
      enabled: false,
      provider: "wallee_cloud_till",
      device_id: null
    }
  }
};

export function loadPosSettings(): PosSettingsFile {
  const siteConfig = loadLocalSiteConfig();
  const walleeStatus = getWalleeConfigStatus();
  const baseSettings = {
    ...posSettings.settings,
    tenant_id: siteConfig.tenant.id,
    location_id: siteConfig.location.id,
    service_mode: siteConfig.service_mode
  };

  return {
    path: posSettings.path,
    settings: {
      ...baseSettings,
      receipt_printer: { ...baseSettings.receipt_printer },
      payment_terminal: {
        enabled: walleeStatus.enabled,
        provider: "wallee_cloud_till",
        device_id: walleeStatus.active_config_version === null ? null : String(walleeStatus.active_config_version)
      }
    }
  };
}

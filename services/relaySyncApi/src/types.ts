export type TenantStatus = "ACTIVE" | "SUSPENDED";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
};

export type TenantCreateRequest = {
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  status?: TenantStatus;
};

export type TenantUpdateRequest = Partial<TenantCreateRequest>;

export type TenantUserRole = "OWNER" | "MANAGER" | "STAFF" | "KDS" | "POS_OPERATOR";

export type TenantLocationUser = {
  user_id: string;
  tenant_id: string;
  location_id: string;
  email: string;
  display_name: string;
  role: TenantUserRole;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  has_password: boolean;
  has_pin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TenantLocationUserCreateRequest = {
  email: string;
  display_name: string;
  role: TenantUserRole;
  password?: string | null;
  pin?: string | null;
  status?: "ACTIVE" | "INVITED" | "DISABLED";
  is_active?: boolean;
};

export type TenantLocationUserUpdateRequest = Partial<TenantLocationUserCreateRequest>;

export type LocationStatus = "ACTIVE" | "SUSPENDED";
export type LocationServiceMode = "TABLE_SERVICE" | "COUNTER_SERVICE";

export type Location = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  address: string | null;
  local_master_instance_id: string | null;
  service_mode: LocationServiceMode;
  status: LocationStatus;
  created_at: string;
  updated_at: string;
};

export type LocationCreateRequest = {
  name: string;
  slug: string;
  address?: string | null;
  local_master_instance_id?: string | null;
  service_mode?: LocationServiceMode;
  status?: LocationStatus;
};

export type LocationUpdateRequest = Partial<LocationCreateRequest>;

export type CatalogOutputStation = {
  id: string;
  tenant_id: string;
  location_id: string | null;
  name: string;
  kind: string;
  has_kds: boolean;
  has_printer: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CatalogOutputStationCreateRequest = {
  name: string;
  has_kds: boolean;
  has_printer: boolean;
  is_active?: boolean;
  sort_order?: number;
};

export type CatalogOutputStationUpdateRequest = Partial<CatalogOutputStationCreateRequest>;

export type LocalMasterPairingSessionStatus = "ACTIVE" | "USED" | "EXPIRED" | "NONE";

export type LocalMasterPairingSession = {
  id: string;
  tenant_id: string;
  location_id: string;
  setup_code: string | null;
  status: LocalMasterPairingSessionStatus;
  expires_at: string | null;
  used_at: string | null;
  local_master_instance_id: string | null;
  local_master_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LocalMasterPairRequest = {
  setup_code: string;
  instance_id: string;
  location_id?: string | null;
  local_master_url?: string | null;
  version?: string | null;
};

export type LocalMasterPairResponse = {
  tenant_id: string;
  location_id: string;
  local_master_instance_id: string;
  relay_token: string;
  relay_base_url: string;
  paired_at: string;
};

export type RelayCommand = {
  command_id: string;
  tenant_id: string;
  location_id: string;
  local_master_instance_id: string;
  type: string;
  status: "pending" | "delivered" | "accepted" | "failed";
  payload: unknown;
  result: unknown | null;
  created_at: string;
  updated_at: string;
};

export type RelayCommandAckRequest = {
  status: "accepted" | "failed";
  result?: unknown;
  error?: string | null;
};

export type LocalMasterBootstrap = {
  tenant: Tenant;
  location: Location;
  service_mode: LocationServiceMode;
  output_stations: CatalogOutputStation[];
  users: Array<{
    user_id: string;
    email: string;
    display_name: string;
    role: TenantUserRole;
    status: "ACTIVE" | "INVITED" | "DISABLED";
    pin_hash: string | null;
    is_active: boolean;
  }>;
  bootstrapped_at: string;
};

export type OnboardingStatus = {
  tenant_id: string;
  location_id: string;
  tenant_ready: boolean;
  location_ready: boolean;
  output_station_count: number;
  user_count: number;
  pairing_status: LocalMasterPairingSessionStatus | "PAIRED";
  local_master_instance_id: string | null;
};

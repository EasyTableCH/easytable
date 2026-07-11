export type StaffLocationContext = {
  id: string;
  name: string;
  status: string;
  serviceMode: "TABLE_SERVICE" | "COUNTER_SERVICE";
  localMasterInstanceId: string | null;
  connectionStatus: "PAIRED" | "UNPAIRED";
};

export type StaffTenantContext = {
  tenantId: string;
  tenantName: string;
  role: string;
  locations: StaffLocationContext[];
};

export type StaffAuthContext = {
  user: { id: string; email: string; name?: string | null; role?: string | null };
  tenants: StaffTenantContext[];
};

export type ActiveStaffContext = {
  tenantId: string;
  tenantName: string;
  locationId: string;
  locationName: string;
  role: string;
  serviceMode: StaffLocationContext["serviceMode"];
  localMasterInstanceId: string | null;
};

export function listSelectableStaffContexts(auth: StaffAuthContext): ActiveStaffContext[] {
  return auth.tenants.flatMap((tenant) => tenant.locations.map((location) => ({
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    locationId: location.id,
    locationName: location.name,
    role: tenant.role,
    serviceMode: location.serviceMode,
    localMasterInstanceId: location.localMasterInstanceId,
  })));
}

export function resolveStoredStaffContext(auth: StaffAuthContext, storedKey: string | null) {
  const contexts = listSelectableStaffContexts(auth);
  if (storedKey) {
    const selected = contexts.find((context) => context.tenantId + ":" + context.locationId === storedKey);
    if (selected) return selected;
  }
  return contexts.length === 1 ? contexts[0] : null;
}

export function staffContextStorageKey(userId: string) {
  return "easytable.staff.context:" + userId;
}

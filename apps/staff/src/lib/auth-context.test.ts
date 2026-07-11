import assert from "node:assert/strict";
import { test } from "node:test";
import { listSelectableStaffContexts, resolveStoredStaffContext, type StaffAuthContext } from "./auth-context.js";

const auth: StaffAuthContext = {
  user: { id: "user_1", email: "owner@example.test" },
  tenants: [{
    tenantId: "tenant_1", tenantName: "Tenant", role: "OWNER",
    locations: [{ id: "location_1", name: "Main", status: "ACTIVE", serviceMode: "TABLE_SERVICE", localMasterInstanceId: "lm_1", connectionStatus: "PAIRED" }],
  }],
};

test("automatically resolves one available location", () => {
  assert.equal(resolveStoredStaffContext(auth, null)?.locationId, "location_1");
});

test("rejects a stale stored location", () => {
  assert.equal(resolveStoredStaffContext(auth, "tenant_1:missing")?.locationId, "location_1");
});

test("requires an explicit selection when multiple locations are available", () => {
  const multi = structuredClone(auth);
  multi.tenants[0].locations.push({ ...multi.tenants[0].locations[0], id: "location_2", name: "Second" });
  assert.equal(resolveStoredStaffContext(multi, null), null);
  assert.equal(listSelectableStaffContexts(multi).length, 2);
});

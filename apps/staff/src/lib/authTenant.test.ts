import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveTenantRelation, type TenantRelation } from "./authTenant.js";

const foodtruck: TenantRelation = {
  tenantId: "tenant_foodtruck",
  tenantName: "Foodtruck",
  role: "OWNER",
};

test("uses the only tenant membership when no tenant is configured", () => {
  assert.equal(resolveTenantRelation([foodtruck]), foodtruck);
});

test("uses the explicitly configured tenant for multi-tenant users", () => {
  const restaurant = { ...foodtruck, tenantId: "tenant_restaurant", tenantName: "Restaurant" };

  assert.equal(resolveTenantRelation([foodtruck, restaurant], "tenant_foodtruck"), foodtruck);
});

test("does not guess when multiple tenants exist without configuration", () => {
  const restaurant = { ...foodtruck, tenantId: "tenant_restaurant", tenantName: "Restaurant" };

  assert.equal(resolveTenantRelation([foodtruck, restaurant]), undefined);
});

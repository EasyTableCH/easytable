import assert from "node:assert/strict";
import { test } from "node:test";

import { ownerCatalogItems } from "./AppLayout.js";
import { defaultView } from "./navigation.js";

test("owner navigation includes analytics without changing default owner entry", () => {
  assert.equal(defaultView.ownerSection, "products");
  assert.ok(ownerCatalogItems.some((item) => item.section === "analytics" && item.label === "Analytics"));
});

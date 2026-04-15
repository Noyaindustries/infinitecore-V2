import assert from "node:assert/strict";
import { buildDbFiltersFromQueryFilters, parseDataQueryInput, type QueryFilter } from "../src/api/dataRoutes";

const parsed = parseDataQueryInput({
  collectionPath: " users ",
  filters: [{ field: "role", operator: "==", value: "admin" }],
  orders: [{ field: "createdAt", direction: "desc" }],
  limit: 50000,
  offset: 20,
});

assert.equal(parsed.collectionPathRaw, " users ");
assert.equal(parsed.limit, 1000);
assert.equal(parsed.offset, 20);

const defaultParsed = parseDataQueryInput({});
assert.equal(defaultParsed.limit, 100);
assert.equal(defaultParsed.offset, 0);

const filters: QueryFilter[] = [
  { field: "role", operator: "==", value: "admin" },
  { field: "score", operator: ">=", value: 10 },
  { field: "score", operator: "<", value: 20 },
];
const dbFilters = buildDbFiltersFromQueryFilters(filters);
assert.ok(Array.isArray(dbFilters));
assert.equal(dbFilters?.length, 3);

console.log("Data query tests passed");

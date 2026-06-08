import { describe, expect, it } from "vitest";
import { sanitizeFilters, sanitizeOrders } from "../../src/api/mongo/sanitizeDataQuery";
import {
  assertSafeDocumentPayload,
  containsMongoOperatorKeys,
  isSafeCollectionPathInput,
} from "../../src/api/mongo/noSqlInjectionGuard";
import { parseDataQueryInput } from "../../src/api/dataRoutes";

describe("noSqlInjectionGuard", () => {
  it("détecte $gt dans un objet imbriqué", () => {
    expect(containsMongoOperatorKeys({ filters: [{ value: { $gt: "" } }] })).toBe(true);
  });

  it("détecte $where en clé racine", () => {
    expect(containsMongoOperatorKeys({ $where: "1==1" })).toBe(true);
  });

  it("accepte un payload primitif normal", () => {
    expect(containsMongoOperatorKeys({ role: "admin", score: 10 })).toBe(false);
  });

  it("rejette les chemins de collection avec $", () => {
    expect(isSafeCollectionPathInput("users/$gt")).toBe(false);
    expect(isSafeCollectionPathInput("users")).toBe(true);
  });

  it("rejette les documents avec opérateurs MongoDB", () => {
    expect(assertSafeDocumentPayload({ $set: { admin: true } }).ok).toBe(false);
    expect(assertSafeDocumentPayload({ name: "Alice" }).ok).toBe(true);
  });
});

describe("sanitizeFilters — injection NoSQL", () => {
  it("rejette un opérateur non whitelisté", () => {
    expect(
      sanitizeFilters([{ field: "role", operator: "$gt" as never, value: "admin" }])
    ).toBeNull();
  });

  it("rejette une valeur objet ($ne)", () => {
    expect(
      sanitizeFilters([{ field: "role", operator: "==", value: { $ne: null } as never }])
    ).toBeNull();
  });

  it("rejette un champ avec $", () => {
    expect(sanitizeFilters([{ field: "$where", operator: "==", value: "x" }])).toBeNull();
  });

  it("accepte des filtres primitifs valides", () => {
    expect(
      sanitizeFilters([
        { field: "role", operator: "==", value: "admin" },
        { field: "score", operator: ">=", value: 10 },
      ])
    ).toEqual([
      { field: "role", operator: "==", value: "admin" },
      { field: "score", operator: ">=", value: 10 },
    ]);
  });
});

describe("sanitizeOrders — injection", () => {
  it("rejette un champ suspect", () => {
    expect(sanitizeOrders([{ field: "$natural", direction: "asc" }])).toBeNull();
  });
});

describe("parseDataQueryInput — garde-fous", () => {
  it("rejette un body avec opérateurs MongoDB", () => {
    const parsed = parseDataQueryInput({
      collectionPath: "users",
      filters: [{ field: "role", operator: "==", value: { $gt: "" } }],
    });
    expect(parsed.invalid).toBe(true);
  });

  it("rejette un collectionPath avec $", () => {
    expect(parseDataQueryInput({ collectionPath: "users/$where" }).invalid).toBe(true);
  });
});

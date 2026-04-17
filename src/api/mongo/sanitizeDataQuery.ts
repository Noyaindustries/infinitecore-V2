import type { QueryFilter, QueryOrder } from "./dataQueryTypes";

const SAFE_FIELD_NAME = /^[A-Za-z0-9_.-]{1,120}$/;
const MAX_FILTERS = 12;
const MAX_ORDERS = 6;
const VALID_OPERATORS = new Set<QueryFilter["operator"]>(["==", "!=", ">", ">=", "<", "<="]);

function isPrimitiveQueryValue(value: unknown) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function sanitizeFilters(raw: unknown): QueryFilter[] | null {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_FILTERS) return null;
  const filters: QueryFilter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const field = String((item as QueryFilter).field || "").trim();
    const operator = (item as QueryFilter).operator;
    const value = (item as QueryFilter).value;
    if (!SAFE_FIELD_NAME.test(field) || !VALID_OPERATORS.has(operator) || !isPrimitiveQueryValue(value)) {
      return null;
    }
    filters.push({ field, operator, value });
  }
  return filters;
}

export function sanitizeOrders(raw: unknown): QueryOrder[] | null {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_ORDERS) return null;
  const orders: QueryOrder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const field = String((item as QueryOrder).field || "").trim();
    const directionRaw = String((item as QueryOrder).direction || "asc").toLowerCase();
    if (!SAFE_FIELD_NAME.test(field)) return null;
    if (directionRaw !== "asc" && directionRaw !== "desc") return null;
    orders.push({ field, direction: directionRaw });
  }
  return orders;
}

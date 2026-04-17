/** Opérateurs supportés par `POST /api/data/query` (filtrage applicatif). */
export type QueryFilterOperator = "==" | "!=" | ">" | ">=" | "<" | "<=";

export type QueryFilter = {
  field: string;
  operator: QueryFilterOperator;
  value: unknown;
};

export type QueryOrder = {
  field: string;
  direction?: "asc" | "desc";
};

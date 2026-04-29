import { apiRequest } from "./apiClient";

type Primitive = string | number | boolean | null;
type DocData = Record<string, any>;

type QueryFilterConstraint = {
  kind: "where";
  field: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  value: Primitive;
};

type QueryOrderConstraint = {
  kind: "orderBy";
  field: string;
  direction: "asc" | "desc";
};

type QueryLimitConstraint = {
  kind: "limit";
  value: number;
};

type QueryConstraint = QueryFilterConstraint | QueryOrderConstraint | QueryLimitConstraint;

type InternalDoc = { id: string; data: DocData };

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 15000;
const DELETE_FIELD_SENTINEL = "__delete_field__";
const SESSION_HINT_KEY = "ic_has_session_hint";
const LEGACY_TOKEN_KEY = "ic_auth_token";

function randomId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function normalizePath(path: string) {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function hasLikelyClientSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const hasHint = localStorage.getItem(SESSION_HINT_KEY) === "1";
    const hasLegacyToken = Boolean(localStorage.getItem(LEGACY_TOKEN_KEY));
    return hasHint || hasLegacyToken;
  } catch {
    return false;
  }
}

function isAuthHttpError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (!("status" in error)) return false;
  const status = Number((error as { status?: unknown }).status);
  return status === 401 || status === 403;
}

function clearClientSessionHints() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Ignore localStorage errors.
  }
}

/** Aligne les alias de chemins « Firestore » sur les noms stockés côté API (`data_documents`). */
function canonicalDataCollectionPath(collectionPath: string): string {
  const parts = normalizePath(collectionPath).split("/");
  if (parts[0] === "padde-ci-audits") parts[0] = "padde_ci_audits";
  return parts.join("/");
}

function splitDocPath(path: string): { collectionPath: string; docId: string } {
  const parts = normalizePath(path).split("/");
  if (parts.length < 2) throw new Error(`Chemin document invalide: ${path}`);
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join("/");
  return { collectionPath, docId };
}

export class CollectionReference<T = DocData> {
  readonly path: string;

  constructor(path: string) {
    this.path = normalizePath(path);
  }
}

export class DocumentReference<T = DocData> {
  readonly path: string;
  readonly id: string;

  constructor(path: string) {
    this.path = normalizePath(path);
    this.id = this.path.split("/").at(-1) || "";
  }
}

export class Query<T = DocData> {
  readonly path: string;
  readonly constraints: QueryConstraint[];

  constructor(path: string, constraints: QueryConstraint[]) {
    this.path = normalizePath(path);
    this.constraints = constraints;
  }
}

export class DocumentSnapshot<T = any> {
  readonly id: string;
  readonly ref: DocumentReference<T>;
  private readonly _data: T | null;

  constructor(ref: DocumentReference<T>, data: T | null) {
    this.ref = ref;
    this.id = ref.id;
    this._data = data;
  }

  exists() {
    return this._data !== null;
  }

  data() {
    return this._data;
  }
}

export class QueryDocumentSnapshot<T = any> extends DocumentSnapshot<T> {
  data() {
    return super.data() as T;
  }
}

export class QuerySnapshot<T = any> {
  readonly docs: QueryDocumentSnapshot<T>[];

  constructor(docs: QueryDocumentSnapshot<T>[]) {
    this.docs = docs;
  }

  get empty() {
    return this.docs.length === 0;
  }

  get size() {
    return this.docs.length;
  }
}

export type Firestore = Record<string, never>;
export const db: Firestore = {};

export function initializeFirestore(..._args: unknown[]) {
  return db;
}

export function getFirestore(..._args: unknown[]) {
  return db;
}

export function collection(
  parent: Firestore | DocumentReference | CollectionReference,
  ...segments: string[]
): CollectionReference {
  if (parent instanceof DocumentReference || parent instanceof CollectionReference) {
    return new CollectionReference([parent.path, ...segments].join("/"));
  }
  return new CollectionReference(segments.join("/"));
}

export function doc(
  parent: Firestore | CollectionReference | DocumentReference,
  ...segments: string[]
): DocumentReference {
  if (parent instanceof CollectionReference || parent instanceof DocumentReference) {
    if (!segments.length) return new DocumentReference(`${parent.path}/${randomId()}`);
    return new DocumentReference([parent.path, ...segments].join("/"));
  }
  if (!segments.length) throw new Error("doc() requiert un chemin ou une collection.");
  return new DocumentReference(segments.join("/"));
}

export function where(
  field: string,
  operator: QueryFilterConstraint["operator"],
  value: Primitive
): QueryFilterConstraint {
  return { kind: "where", field, operator, value };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): QueryOrderConstraint {
  return { kind: "orderBy", field, direction };
}

export function limit(value: number): QueryLimitConstraint {
  return { kind: "limit", value };
}

export function query(base: CollectionReference, ...constraints: QueryConstraint[]): Query {
  return new Query(base.path, constraints);
}

function toQuerySnapshot(path: string, docs: InternalDoc[]) {
  const mapped = docs.map((row) => new QueryDocumentSnapshot(new DocumentReference(`${path}/${row.id}`), row.data));
  return new QuerySnapshot(mapped);
}

async function fetchQuery(q: Query | CollectionReference): Promise<QuerySnapshot> {
  const path = q instanceof Query ? q.path : q.path;
  if (!hasLikelyClientSession()) {
    return toQuerySnapshot(path, []);
  }
  const constraints = q instanceof Query ? q.constraints : [];
  const filters = constraints.filter((c): c is QueryFilterConstraint => c.kind === "where");
  const orders = constraints.filter((c): c is QueryOrderConstraint => c.kind === "orderBy");
  const capped = constraints.find((c): c is QueryLimitConstraint => c.kind === "limit");
  let payload: {
    success: boolean;
    docs: InternalDoc[];
    queryMeta?: Record<string, unknown>;
  };
  try {
    payload = await apiRequest<{
      success: boolean;
      docs: InternalDoc[];
      queryMeta?: Record<string, unknown>;
    }>("/api/data/query", {
      method: "POST",
      body: JSON.stringify({
        collectionPath: canonicalDataCollectionPath(path),
        filters: filters.map((f) => ({ field: f.field, operator: f.operator, value: f.value })),
        orders: orders.map((o) => ({ field: o.field, direction: o.direction })),
        limit: capped?.value,
      }),
    });
  } catch (error) {
    if (isAuthHttpError(error)) {
      clearClientSessionHints();
      return toQuerySnapshot(path, []);
    }
    throw error;
  }
  const rows = Array.isArray(payload.docs) ? payload.docs : [];
  return toQuerySnapshot(path, rows);
}

export async function getDocs(q: Query | CollectionReference) {
  return fetchQuery(q);
}

export async function getDoc<T = any>(ref: DocumentReference<T>) {
  if (!hasLikelyClientSession()) {
    return new DocumentSnapshot<T>(ref, null);
  }
  const { collectionPath, docId } = splitDocPath(ref.path);
  const apiCollectionPath = canonicalDataCollectionPath(collectionPath);
  let payload: { success: boolean; exists: boolean; doc: InternalDoc | null };
  try {
    payload = await apiRequest<{ success: boolean; exists: boolean; doc: InternalDoc | null }>(
      `/api/data/doc?collectionPath=${encodeURIComponent(apiCollectionPath)}&docId=${encodeURIComponent(docId)}`
    );
  } catch (error) {
    if (isAuthHttpError(error)) {
      clearClientSessionHints();
      return new DocumentSnapshot<T>(ref, null);
    }
    throw error;
  }
  const data = payload.exists && payload.doc ? (payload.doc.data as T) : null;
  return new DocumentSnapshot<T>(ref, data);
}

export async function getDocFromServer<T = any>(ref: DocumentReference<T>) {
  return getDoc(ref);
}

export async function setDoc<T extends DocData = DocData>(ref: DocumentReference<T>, data: T, options?: { merge?: boolean }) {
  const { collectionPath, docId } = splitDocPath(ref.path);
  await apiRequest("/api/data/doc", {
    method: "POST",
    body: JSON.stringify({
      collectionPath: canonicalDataCollectionPath(collectionPath),
      docId,
      data,
      merge: Boolean(options?.merge),
    }),
  });
}

export async function addDoc<T extends DocData = DocData>(col: CollectionReference<T>, data: T) {
  const docRef = doc(col);
  await setDoc(docRef, data);
  return docRef;
}

export async function updateDoc<T = any>(ref: DocumentReference<T>, updates: Partial<T>) {
  const { collectionPath, docId } = splitDocPath(ref.path);
  const normalized: Record<string, unknown> = {};
  const deleteKeys: string[] = [];
  for (const [key, value] of Object.entries(updates as Record<string, unknown>)) {
    if (value === DELETE_FIELD_SENTINEL) deleteKeys.push(key);
    else normalized[key] = value;
  }
  await apiRequest("/api/data/doc", {
    method: "PATCH",
    body: JSON.stringify({
      collectionPath: canonicalDataCollectionPath(collectionPath),
      docId,
      data: normalized,
      deleteKeys,
    }),
  });
}

export async function deleteDoc<T = any>(ref: DocumentReference<T>) {
  const { collectionPath, docId } = splitDocPath(ref.path);
  const apiCollectionPath = canonicalDataCollectionPath(collectionPath);
  await apiRequest(`/api/data/doc?collectionPath=${encodeURIComponent(apiCollectionPath)}&docId=${encodeURIComponent(docId)}`, {
    method: "DELETE",
  });
}

function stableSerialize(value: unknown) {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

export function onSnapshot<T = DocData>(
  target: DocumentReference<T>,
  onNext: (snapshot: DocumentSnapshot<T>) => void,
  onError?: (error: unknown) => void
): () => void;
export function onSnapshot<T = DocData>(
  target: Query<T> | CollectionReference<T>,
  onNext: (snapshot: QuerySnapshot<T>) => void,
  onError?: (error: unknown) => void
): () => void;
export function onSnapshot<T = DocData>(
  target: DocumentReference<T> | Query<T> | CollectionReference<T>,
  onNext: ((snapshot: DocumentSnapshot<T>) => void) | ((snapshot: QuerySnapshot<T>) => void),
  onError?: (error: unknown) => void
) {
  let active = true;
  let previousSignature = "";
  let currentIntervalMs = POLL_INTERVAL_MS;
  let timeoutId: number | null = null;

  const scheduleNext = () => {
    if (!active) return;
    const hiddenMultiplier = typeof document !== "undefined" && document.hidden ? 2 : 1;
    const nextDelay = Math.min(MAX_POLL_INTERVAL_MS, currentIntervalMs * hiddenMultiplier);
    timeoutId = window.setTimeout(poll, nextDelay);
  };

  const poll = async () => {
    if (!active) return;
    try {
      const snapshot =
        target instanceof DocumentReference ? await getDoc(target) : await fetchQuery(target as Query | CollectionReference);
      const signature =
        snapshot instanceof QuerySnapshot
          ? stableSerialize(snapshot.docs.map((d) => ({ id: d.id, data: d.data() })))
          : stableSerialize({ id: snapshot.id, exists: snapshot.exists(), data: snapshot.data() });
      if (signature !== previousSignature) {
        previousSignature = signature;
        currentIntervalMs = POLL_INTERVAL_MS;
        if (snapshot instanceof QuerySnapshot) {
          (onNext as (snapshot: QuerySnapshot<T>) => void)(snapshot as QuerySnapshot<T>);
        } else {
          (onNext as (snapshot: DocumentSnapshot<T>) => void)(snapshot as DocumentSnapshot<T>);
        }
      } else {
        currentIntervalMs = Math.min(MAX_POLL_INTERVAL_MS, Math.round(currentIntervalMs * 1.5));
      }
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number((error as { status?: unknown }).status)
          : NaN;
      if (status === 401 || status === 403) {
        // Session absente/expirée : stoppe ce listener pour éviter une boucle d'erreurs réseau.
        active = false;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        return;
      }
      currentIntervalMs = Math.min(MAX_POLL_INTERVAL_MS, currentIntervalMs * 2);
      onError?.(error);
    } finally {
      scheduleNext();
    }
  };

  void poll();
  return () => {
    active = false;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

export function writeBatch(_db: Firestore) {
  const ops: Array<() => Promise<void>> = [];
  return {
    set<T extends DocData = DocData>(ref: DocumentReference<T>, data: T, options?: { merge?: boolean }) {
      ops.push(() => setDoc(ref, data, options));
    },
    update<T extends DocData = DocData>(ref: DocumentReference<T>, data: Partial<T>) {
      ops.push(() => updateDoc(ref, data));
    },
    delete<T extends DocData = DocData>(ref: DocumentReference<T>) {
      ops.push(() => deleteDoc(ref));
    },
    async commit() {
      for (const op of ops) {
        await op();
      }
    },
  };
}

type TransactionOp = () => Promise<void>;

export function runTransaction<T>(_db: Firestore, handler: (tx: {
  get: <D extends DocData = DocData>(ref: DocumentReference<D>) => Promise<DocumentSnapshot<D>>;
  set: <D extends DocData = DocData>(ref: DocumentReference<D>, data: D, options?: { merge?: boolean }) => void;
  update: <D extends DocData = DocData>(ref: DocumentReference<D>, data: Partial<D>) => void;
}) => Promise<T>): Promise<T> {
  const ops: TransactionOp[] = [];
  const tx = {
    get: <D extends DocData = DocData>(ref: DocumentReference<D>) => getDoc(ref),
    set: <D extends DocData = DocData>(ref: DocumentReference<D>, data: D, options?: { merge?: boolean }) => {
      ops.push(() => setDoc(ref, data, options));
    },
    update: <D extends DocData = DocData>(ref: DocumentReference<D>, data: Partial<D>) => {
      ops.push(() => updateDoc(ref, data));
    },
  };

  return (async () => {
    const result = await handler(tx);
    for (const op of ops) {
      await op();
    }
    return result;
  })();
}

export function deleteField() {
  return DELETE_FIELD_SENTINEL;
}

export const Timestamp = {
  now() {
    return new Date();
  },
  fromDate(date: Date) {
    return date;
  },
};

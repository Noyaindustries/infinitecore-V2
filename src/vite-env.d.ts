/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origine du backend (ex. http://127.0.0.1:3000) si le front n’est pas servi par le même hôte que /api */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

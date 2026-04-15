declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL API exposée au navigateur si l’API est sur un autre domaine (CORS requis). */
    NEXT_PUBLIC_API_BASE_URL?: string;
    /** Active l'ancien mode Bearer localStorage (par défaut: cookie HttpOnly). */
    NEXT_PUBLIC_USE_LEGACY_BEARER?: string;
    /** OAuth Google (sélecteur de compte) — ID client Web, importable côté navigateur. */
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    /** URL canonique du front (liens e-mail, même usage que NextAuth). */
    NEXTAUTH_URL?: string;
    /** Secret de signature des JWT (même usage que `NEXTAUTH_SECRET` NextAuth). */
    NEXTAUTH_SECRET?: string;
    /** Repli si `NEXTAUTH_SECRET` n’est pas défini. */
    JWT_SECRET?: string;
    /** Repli si `NEXTAUTH_URL` n’est pas défini. */
    APP_BASE_URL?: string;
  }
}

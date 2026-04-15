declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL API exposée au navigateur si l’API est sur un autre domaine (CORS requis). */
    NEXT_PUBLIC_API_BASE_URL?: string;
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

# Protection CSRF — Infinite Core V2

## Applicabilité

Infinite Core utilise une session **cookie httpOnly** (`ic_auth_token`, `SameSite=Lax`) et, en dev/E2E, un jeton **Bearer** legacy (`NEXT_PUBLIC_USE_LEGACY_BEARER=1`).

| Vecteur | Mitigation |
|---------|------------|
| POST cross-site avec cookie (classique CSRF) | `SameSite=Lax` — le navigateur n’envoie pas le cookie sur les POST tiers |
| API cross-origin | CORS strict (`CORS_ORIGIN`), pas de wildcard |
| Requêtes cookie authentifiées en **production** | Origin/Referer + jeton double-submit (`ic_csrf` / `X-CSRF-Token`) |
| Connexion / inscription (`/api/auth/login`, `/api/auth/google`, etc.) | **Exclues** du CSRF (cookie auth obsolète encore envoyé par le navigateur) |
| Intégrations serveur-serveur | Header `Authorization: Bearer` (hors scope CSRF cookie) |
| Webhooks Stripe / PADDE | HMAC dédié, chemins exclus du middleware CSRF |

La protection CSRF **s’applique** aux mutations (`POST`, `PUT`, `PATCH`, `DELETE`) lorsque :

1. L’environnement est **production** (`CSRF_PROTECTION` ≠ `0`)
2. La requête porte le cookie `ic_auth_token`
3. Il n’y a **pas** de header `Authorization: Bearer`

Les clients API (scripts, Playwright avec Bearer) ne sont pas soumis au jeton CSRF.

---

## Implémentation

- Middleware : `src/server/csrfProtection.ts`
- Cookie CSRF : `ic_csrf` (lisible par JS, `SameSite=Lax`)
- Header attendu : `X-CSRF-Token` (identique au cookie)
- Émis à la connexion / inscription / Google OAuth (`setCsrfCookie` dans `mongoApi.ts`)
- Front : `src/lib/apiClient.ts` envoie automatiquement le header si le cookie est présent

### Désactivation (urgence)

```bash
CSRF_PROTECTION=0
```

Uniquement en cas d’incident ; remettre à `1` ou retirer la variable après correction.

---

## Vérification

```bash
npm run lint
npx vitest run tests/security/csrfProtection.vitest.ts
```

En production, après déploiement : connexion → mutation (ex. mise à jour profil) doit réussir ; requête curl avec cookie seul sans Origin/CSRF doit recevoir **403**.

Voir aussi : [`SECRETS_MANAGEMENT.md`](./SECRETS_MANAGEMENT.md), [`PENTESTING.md`](./PENTESTING.md).

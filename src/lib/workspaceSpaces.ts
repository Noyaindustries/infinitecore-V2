/**
 * Cartographie des espaces Infinite Core (alignée sur App.tsx + ProtectedRoute).
 * Une seule source de vérité pour que tous les layouts et le marketing exposent les mêmes liens.
 */

export type AppUserRole = 'admin' | 'commando' | 'client' | 'developer' | 'partner';

export type WorkspaceId =
  | 'marketing'
  | 'superadmin'
  | 'commando'
  | 'client_portal'
  | 'developer'
  | 'partner';

export interface WorkspaceEntry {
  id: WorkspaceId;
  to: string;
  label: string;
  allowedRoles: readonly AppUserRole[];
}

const WORKSPACES: readonly WorkspaceEntry[] = [
  {
    id: 'marketing',
    to: '/',
    label: 'Site & solutions',
    allowedRoles: ['admin', 'commando', 'client', 'developer', 'partner'],
  },
  {
    id: 'superadmin',
    to: '/superadmin',
    label: 'Espace SuperAdmin',
    allowedRoles: ['admin'],
  },
  {
    id: 'commando',
    to: '/admin',
    label: 'Espace Commando',
    allowedRoles: ['admin', 'commando'],
  },
  {
    id: 'client_portal',
    to: '/dashboard',
    label: 'Mon espace client',
    allowedRoles: ['client'],
  },
  {
    id: 'developer',
    to: '/developer',
    label: 'Espace développeur',
    allowedRoles: ['admin', 'developer'],
  },
  {
    id: 'partner',
    to: '/partenaire',
    label: 'Espace partenaire',
    allowedRoles: ['admin', 'partner', 'commando'],
  },
] as const;

function isAppUserRole(role: string): role is AppUserRole {
  return role === 'admin' || role === 'commando' || role === 'client' || role === 'developer' || role === 'partner';
}

/** Espaces accessibles au rôle courant (selon les routes protégées du projet). */
export function getAccessibleWorkspaces(role: unknown): WorkspaceEntry[] {
  const r = typeof role === "string" ? role : undefined;
  if (!r || !isAppUserRole(r)) return [];
  return WORKSPACES.filter((w) => w.allowedRoles.includes(r));
}

/** Liens ordonnés pour menus (site en premier, puis espaces produit). */
export function getWorkspaceNavLinks(role: unknown): { to: string; label: string; id: WorkspaceId }[] {
  const order: WorkspaceId[] = [
    'marketing',
    'superadmin',
    'commando',
    'client_portal',
    'developer',
    'partner',
  ];
  const accessible = new Set(getAccessibleWorkspaces(role).map((w) => w.id));
  return order
    .filter((id) => accessible.has(id))
    .map((id) => {
      const w = WORKSPACES.find((x) => x.id === id)!;
      return { to: w.to, label: w.label, id: w.id };
    });
}

/** Espaces applicatifs uniquement (sans le site marketing) — menus compte header marketing. */
export function getWorkspaceAccountLinks(role: unknown): { to: string; label: string }[] {
  return getWorkspaceNavLinks(role).filter((l) => l.id !== 'marketing').map(({ to, label }) => ({ to, label }));
}

/** Détecte l’espace actif à partir de l’URL (hors pages marketing génériques → null). */
export function detectWorkspaceFromPath(pathname: string): WorkspaceId | null {
  if (pathname.startsWith('/superadmin')) return 'superadmin';
  if (pathname.startsWith('/admin')) return 'commando';
  if (pathname.startsWith('/dashboard')) return 'client_portal';
  if (pathname.startsWith('/developer')) return 'developer';
  if (pathname.startsWith('/partenaire')) return 'partner';
  return null;
}

export function isMarketingPublicZone(pathname: string): boolean {
  return detectWorkspaceFromPath(pathname) === null;
}

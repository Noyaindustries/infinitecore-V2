/** Les 3 audits PADDE-CI gratuits (formulaires externes). */
export interface PaddeCiFreeAudit {
  id: string;
  title: string;
  desc: string;
  duration: string;
  formUrl: string;
}

export const PADDE_CI_FREE_AUDITS: PaddeCiFreeAudit[] = [
  {
    id: 'audit-rapide',
    title: 'Audit Rapide PADDE-CI',
    desc: 'Diagnostic digital complet de votre entreprise — rapport PDF personnalisé',
    duration: '48h',
    formUrl: 'https://padde-ci.com/audit-rapide',
  },
  {
    id: 'audit-business',
    title: 'Audit Business PADDE-CI',
    desc: 'Analyse approfondie : digital, commercial, financier, RH',
    duration: '5 jours ouvrables',
    formUrl: 'https://padde-ci.com/audit-business',
  },
  {
    id: 'audit-institutionnel',
    title: 'Audit Institutionnel PADDE-CI',
    desc: 'Audit complet pour structures de grande taille et institutions',
    duration: '10-15 jours',
    formUrl: 'https://padde-ci.com/audit-institutionnel',
  },
];

/**
 * Génère les visuels carte /apps/{id}.svg avec interface fictive et textes en français.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "apps");

const apps = [
  {
    id: "erp-multi-ecole",
    title: "ERP Multi-École",
    subtitle: "Scolarité · Notes · Frais",
    kpi: ["1 248 élèves", "12 établissements", "98 % recouvrement"],
    rows: ["Inscriptions 2025", "Bulletins trimestre 2", "Emplois du temps"],
    badge: "Éducation",
  },
  {
    id: "caisse-enregistreuse",
    title: "Caisse enregistreuse",
    subtitle: "Ventes · Tickets · Encaissement",
    kpi: ["847 500 FCFA", "124 tickets", "Wave + OM"],
    rows: ["Panier en cours", "Clôture de caisse", "Rapport journalier"],
    badge: "Commerce",
  },
  {
    id: "erp-immobiliere",
    title: "ERP immobilière",
    subtitle: "Biens · Baux · Quittances",
    kpi: ["86 biens", "12 mandats actifs", "4 impayés"],
    rows: ["Quittances mars", "Échéances loyers", "Visites planifiées"],
    badge: "Immobilier",
  },
  {
    id: "erp-gestion-stock",
    title: "ERP gestion de stock",
    subtitle: "Entrées · Inventaire · Alertes",
    kpi: ["3 dépôts", "2 410 références", "18 alertes seuil"],
    rows: ["Réception fournisseur", "Inventaire dépôt A", "Transfert inter-sites"],
    badge: "Logistique",
  },
  {
    id: "erp-gestion-evenementielle",
    title: "ERP événementiel",
    subtitle: "Planning · Invités · Billetterie",
    kpi: ["3 événements", "1 420 invités", "78 % budget"],
    rows: ["Gala entreprise", "Prestataires confirmés", "Billetterie en ligne"],
    badge: "Événements",
  },
  {
    id: "crm-boutique",
    title: "CRM Boutique",
    subtitle: "Clients · Fidélité · Ventes",
    kpi: ["5 620 clients", "+18 % fidélité", "Omni-canal"],
    rows: ["Campagne WhatsApp", "Panier abandonné", "Top acheteurs"],
    badge: "Retail",
  },
  {
    id: "app-location-voiture",
    title: "Location voiture",
    subtitle: "Flotte · Réservations · Contrats",
    kpi: ["42 véhicules", "9 réservations", "6 disponibles"],
    rows: ["Contrat sortie", "État des lieux photo", "Facturation location"],
    badge: "Mobilité",
  },
  {
    id: "cms-clinique",
    title: "CMS Clinique",
    subtitle: "RDV · Patients · Téléconsultation",
    kpi: ["34 RDV aujourd'hui", "8 médecins", "File d'attente"],
    rows: ["Agenda consultations", "Dossiers patients", "Téléconsultation"],
    badge: "Santé",
  },
  {
    id: "crm-multi-hotel",
    title: "CRM Multi-Hôtel",
    subtitle: "Chambres · Réservations · Housekeeping",
    kpi: ["4 hôtels", "87 % occupation", "24 chambres à préparer"],
    rows: ["Réservations du jour", "Housekeeping", "Tarifs saisonniers"],
    badge: "Hôtellerie",
  },
];

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svg(app) {
  const kpiBlocks = app.kpi
    .map(
      (k, i) => `
    <rect x="${36 + i * 196}" y="118" width="176" height="52" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)"/>
    <text x="${124 + i * 196}" y="150" text-anchor="middle" fill="#F2F4F8" font-family="system-ui,sans-serif" font-size="13" font-weight="700">${esc(k)}</text>`
    )
    .join("");

  const rowBlocks = app.rows
    .map(
      (r, i) => `
    <rect x="36" y="${188 + i * 44}" width="568" height="36" rx="8" fill="rgba(255,255,255,0.04)"/>
    <circle cx="56" cy="${206 + i * 44}" r="5" fill="#FFB332"/>
    <text x="72" y="${210 + i * 44}" fill="#C8D0E0" font-family="system-ui,sans-serif" font-size="14" font-weight="600">${esc(r)}</text>
    <text x="580" y="${210 + i * 44}" text-anchor="end" fill="#6EA7EA" font-family="system-ui,sans-serif" font-size="12">Ouvrir →</text>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="640" y2="360" gradientUnits="userSpaceOnUse">
      <stop stop-color="#06080D"/>
      <stop offset="0.45" stop-color="#0D1320"/>
      <stop offset="1" stop-color="#1a365d"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#FFB332"/>
      <stop offset="1" stop-color="#E2912D"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="640" height="360" rx="20" fill="url(#bg)"/>
  <rect x="0" y="300" width="640" height="60" fill="rgba(0,0,0,0.45)"/>
  <circle cx="560" cy="52" r="80" fill="rgba(110,167,234,0.12)" filter="url(#glow)"/>
  <rect x="24" y="20" width="592" height="268" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)"/>
  <rect x="36" y="32" width="120" height="28" rx="14" fill="url(#accent)"/>
  <text x="96" y="51" text-anchor="middle" fill="#06080D" font-family="system-ui,sans-serif" font-size="12" font-weight="800">${esc(app.badge)}</text>
  <text x="36" y="88" fill="#F2F4F8" font-family="system-ui,sans-serif" font-size="26" font-weight="800">${esc(app.title)}</text>
  <text x="36" y="108" fill="#8D98AA" font-family="system-ui,sans-serif" font-size="14" font-weight="600">${esc(app.subtitle)}</text>
  ${kpiBlocks}
  ${rowBlocks}
  <text x="36" y="332" fill="#F2F4F8" font-family="system-ui,sans-serif" font-size="18" font-weight="800">${esc(app.title)}</text>
  <text x="604" y="332" text-anchor="end" fill="#FFB332" font-family="system-ui,sans-serif" font-size="13" font-weight="700">Infinite Core</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
for (const app of apps) {
  const path = join(OUT, `${app.id}.svg`);
  writeFileSync(path, svg(app), "utf8");
  console.log("OK", path);
}

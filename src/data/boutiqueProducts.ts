/**
 * Enrichissement marketing pour la boutique (/boutique).
 * Les prix viennent toujours de `appCatalog` / useAppCatalog — jamais d’ici.
 */
import type { AppCatalogEntry } from './appCatalog';
import { resolveAppDemoUrl } from '../lib/appDemoUrl';

export type BoutiqueSector =
  | 'commerce'
  | 'education'
  | 'hotel'
  | 'mobility'
  | 'health'
  | 'boutique'
  | 'immobilier'
  | 'stock'
  | 'events';

export type BoutiqueBadge = 'Populaire' | 'Recommandé' | 'Nouveau' | null;

export type BoutiqueModule = {
  ic: string;
  n: string;
  fs: string[];
};

export type BoutiqueDash = {
  title: string;
  stats: { v: string; l: string }[];
  bars: number[];
  rows: { n: string; v: string; c: string }[];
};

export type BoutiqueMarketing = {
  catalogId: string;
  s: BoutiqueSector;
  ic: string;
  c: string;
  sg: string;
  badge: BoutiqueBadge;
  users: number;
  rating: number;
  tl: string;
  incl: [string, string][];
  dash: BoutiqueDash;
  modules: BoutiqueModule[];
};

/** Produit boutique = catalogue + marketing + prix résolus. */
export type BoutiqueProduct = BoutiqueMarketing & {
  id: string;
  n: string;
  desc: string;
  /** Abonnement mensuel SaaS (FCFA), si proposé. */
  monthlyPrice: number | null;
  /** Équivalent mensuel facturé à l’année (−20 %), si abonnement. */
  annualMonthlyPrice: number | null;
  /** Montant total annuel (FCFA), si abonnement annuel. */
  annualTotalPrice: number | null;
  /** Licence à vie (FCFA), si proposée. */
  licPrice: number | null;
  demoUrl: string | null;
  whatsappNumber: string | null;
  whatsappMessage: string | null;
};

export const BOUTIQUE_FILTERS: { id: 'all' | BoutiqueSector; label: string }[] = [
  { id: 'all', label: 'Tous les logiciels' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'education', label: 'Éducation' },
  { id: 'hotel', label: 'Hôtellerie' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'stock', label: 'Stock' },
  { id: 'events', label: 'Événementiel' },
  { id: 'mobility', label: 'Mobilité' },
  { id: 'health', label: 'Santé' },
  { id: 'boutique', label: 'Boutique' },
];

export type BoutiqueSort = 'popularity' | 'price-asc' | 'rating' | 'new';

export const BOUTIQUE_SORT_OPTIONS: { id: BoutiqueSort; label: string }[] = [
  { id: 'popularity', label: 'Popularité' },
  { id: 'price-asc', label: 'Prix croissant' },
  { id: 'rating', label: 'Note' },
  { id: 'new', label: 'Nouveauté' },
];

/** −20 % sur l’équivalent mensuel en facturation annuelle (aligné maquette boutique). */
export function annualFromMonthly(monthly: number): number {
  return Math.round(monthly * 0.8);
}

const MARKETING_BY_CATALOG_ID: Record<string, BoutiqueMarketing> = {
  'caisse-enregistreuse': {
    catalogId: 'caisse-enregistreuse',
    s: 'commerce',
    ic: '🏪',
    c: '#E8961E',
    sg: 'Commerce',
    badge: 'Populaire',
    users: 124,
    rating: 4.9,
    tl: 'La caisse intelligente qui gère votre commerce en temps réel, depuis votre téléphone.',
    incl: [
      ['📦', 'Stock en temps réel'],
      ['🧾', 'Facturation auto'],
      ['👥', 'Base clients'],
      ['📊', 'Rapports journaliers'],
      ['📱', 'Application mobile'],
      ['🔔', 'Alertes de rupture'],
      ['💳', 'Paiement mobile'],
      ['🔄', 'Sauvegarde cloud'],
    ],
    dash: {
      title: 'Caisse — Tableau de bord',
      stats: [
        { v: '847 500', l: 'Ventes aujourd’hui (FCFA)' },
        { v: '34', l: 'Transactions' },
        { v: '12', l: 'Articles en alerte' },
      ],
      bars: [60, 80, 45, 90, 70, 55, 85, 95, 60, 75, 88, 70],
      rows: [
        { n: 'Riz parfumé 5kg', v: '78 unités', c: '#E8961E' },
        { n: 'Huile végétale', v: '45 unités', c: '#4A7FB5' },
        { n: 'Sucre en poudre', v: '102 unités', c: '#2EB464' },
      ],
    },
    modules: [
      {
        ic: '🏪',
        n: 'Caisse',
        fs: [
          'Enregistrement des ventes en 3 clics',
          'Reçus automatiques par SMS ou impression',
          'Multi-modes de paiement (espèces, Mobile Money, chèque)',
          'Gestion des remises et promotions',
          'Clôture de caisse journalière automatique',
        ],
      },
      {
        ic: '📦',
        n: 'Stocks',
        fs: [
          'Inventaire en temps réel sur tous les articles',
          'Alertes automatiques de rupture configurables',
          'Entrées de stock avec codes-barres ou référence',
          'Gestion multi-dépôts et transferts',
          'Historique de tous les mouvements de stock',
        ],
      },
      {
        ic: '👥',
        n: 'Clients',
        fs: [
          'Base de données clients complète',
          "Historique d'achats par client",
          'Programme de fidélité et points',
          'Envoi de reçus et promotions par SMS',
          'Segmentation clients par fréquence',
        ],
      },
      {
        ic: '📊',
        n: 'Rapports',
        fs: [
          'Rapport journalier automatique chaque soir',
          'Top articles les plus vendus',
          'Analyse de performance par caissier',
          'Tableau de bord CA mensuel vs objectifs',
          'Export Excel et PDF',
        ],
      },
    ],
  },
  'erp-multi-ecole': {
    catalogId: 'erp-multi-ecole',
    s: 'education',
    ic: '🎓',
    c: '#4A7FB5',
    sg: 'Éducation',
    badge: 'Recommandé',
    users: 58,
    rating: 4.8,
    tl: 'Gérez inscriptions, bulletins, frais scolaires et communication parents depuis un seul tableau de bord.',
    incl: [
      ['📋', 'Inscriptions numériques'],
      ['📄', 'Bulletins auto'],
      ['💰', 'Suivi des frais'],
      ['📱', 'App parents'],
      ['🗓️', 'Emplois du temps'],
      ['📊', 'Statistiques école'],
      ['📧', 'Notifications parents'],
      ['🔒', 'Données sécurisées'],
    ],
    dash: {
      title: 'ERP Multi-École — Tableau de bord',
      stats: [
        { v: '342', l: 'Élèves inscrits' },
        { v: '94%', l: 'Frais collectés' },
        { v: '18', l: 'Classes actives' },
      ],
      bars: [40, 70, 60, 80, 50, 90, 75, 85, 65, 70, 80, 88],
      rows: [
        { n: '6ème A — Bulletin prêt', v: '28/28 élèves', c: '#2EB464' },
        { n: '3ème B — Frais en attente', v: '5 élèves', c: '#E8961E' },
        { n: 'Terminale C — Emploi du temps', v: 'Mis à jour', c: '#4A7FB5' },
      ],
    },
    modules: [
      {
        ic: '📋',
        n: 'Inscriptions',
        fs: [
          "Formulaire d'inscription numérique en ligne",
          'Gestion des dossiers et documents requis',
          'Affectation automatique dans les classes',
          'Suivi du statut de chaque inscription',
          'Renouvellement annuel simplifié',
        ],
      },
      {
        ic: '📄',
        n: 'Notes & Bulletins',
        fs: [
          'Saisie des notes par matière et professeur',
          'Calcul automatique des moyennes et rangs',
          'Génération des bulletins en PDF',
          'Envoi aux parents par email ou SMS',
          'Historique complet des résultats',
        ],
      },
      {
        ic: '💰',
        n: 'Frais scolaires',
        fs: [
          'Suivi des paiements par élève',
          'Génération de reçus automatiques',
          'Relances automatiques des impayés',
          'Rapports financiers mensuels',
          'Paiement Mobile Money intégré',
        ],
      },
      {
        ic: '📱',
        n: 'Communication',
        fs: [
          'Application parents pour consulter les résultats',
          'Notifications push pour les bulletins',
          'Messagerie directe école-parents',
          'Annonces et circulaires numériques',
          'Suivi des absences en temps réel',
        ],
      },
    ],
  },
  'crm-multi-hotel': {
    catalogId: 'crm-multi-hotel',
    s: 'hotel',
    ic: '💎',
    c: '#C9A44A',
    sg: 'Hôtellerie',
    badge: null,
    users: 32,
    rating: 4.7,
    tl: 'Pilotez réservations, disponibilités, ménage et facturation depuis un seul tableau de bord hôtelier.',
    incl: [
      ['🛏️', 'Gestion chambres'],
      ['📅', 'Réservations live'],
      ['🧹', 'Suivi ménage'],
      ['🧾', 'Facturation auto'],
      ['📊', 'Taux occupation'],
      ['💳', 'Paiements intégrés'],
      ['📱', 'App réception'],
      ['🔔', 'Alertes libération'],
    ],
    dash: {
      title: 'CRM Multi-Hôtel — Réception',
      stats: [
        { v: '18/24', l: 'Chambres occupées (75%)' },
        { v: '6', l: "Arrivées aujourd'hui" },
        { v: '4', l: "Départs aujourd'hui" },
      ],
      bars: [70, 85, 60, 90, 75, 80, 95, 70, 65, 88, 72, 80],
      rows: [
        { n: 'Chambre 101 — Ménage', v: 'En cours', c: '#E8961E' },
        { n: 'Chambre 205 — Libre', v: 'Disponible', c: '#2EB464' },
        { n: 'Réservation #1847', v: 'Check-in 15h00', c: '#4A7FB5' },
      ],
    },
    modules: [
      {
        ic: '📅',
        n: 'Réservations',
        fs: [
          'Calendrier de disponibilités en temps réel',
          'Prise de réservation en ligne et en direct',
          'Gestion des annulations et modifications',
          'Attribution automatique des chambres',
          'Confirmation par SMS ou email',
        ],
      },
      {
        ic: '🛏️',
        n: 'Chambres',
        fs: [
          'Fiche détaillée par chambre (type, équipements)',
          'Statut en temps réel (libre, occupée, ménage)',
          'Tarification dynamique par saison',
          'Gestion des suites et connexions',
          'Maintenance et incidents trackés',
        ],
      },
      {
        ic: '🧹',
        n: 'Housekeeping',
        fs: [
          'Planning de ménage automatique après départ',
          'Checklist de nettoyage par chambre',
          "Rapports de l'équipe d'entretien",
          'Alertes pour les équipements défectueux',
          'Priorités configurables',
        ],
      },
      {
        ic: '🧾',
        n: 'Facturation',
        fs: [
          'Facture automatique à la fin du séjour',
          'Extras et consommations ajoutés en live',
          'Paiement Mobile Money, espèces, carte',
          'Rapports journaliers et hebdomadaires',
          'Archivage numérique des factures',
        ],
      },
    ],
  },
  'app-location-voiture': {
    catalogId: 'app-location-voiture',
    s: 'mobility',
    ic: '🚗',
    c: '#E05252',
    sg: 'Mobilité',
    badge: 'Nouveau',
    users: 12,
    rating: 4.6,
    tl: 'Flotte, réservations, contrats et facturation pour votre activité de location de véhicules.',
    incl: [
      ['📱', 'App iOS & Android'],
      ['🗺️', 'Suivi flotte'],
      ['💳', 'Paiement mobile'],
      ['📄', 'Contrats numériques'],
      ['📊', 'Dashboard admin'],
      ['⭐', 'États des lieux'],
      ['🔔', 'Alertes entretien'],
      ['🧾', 'Facturation auto'],
    ],
    dash: {
      title: 'Location voiture — Dashboard',
      stats: [
        { v: '24', l: 'Véhicules en flotte' },
        { v: '11', l: 'Locations actives' },
        { v: '890k', l: "FCFA — CA aujourd'hui" },
      ],
      bars: [30, 55, 70, 85, 60, 90, 75, 80, 65, 88, 72, 95],
      rows: [
        { n: 'Toyota Corolla — Loc. #412', v: 'Retour 18h', c: '#E05252' },
        { n: 'Hyundai Tucson', v: 'Disponible', c: '#2EB464' },
        { n: 'Entretien — Kia Rio', v: 'Demain', c: '#E8961E' },
      ],
    },
    modules: [
      {
        ic: '🚗',
        n: 'Flotte',
        fs: [
          'Fiche véhicule (immatriculation, km, statut)',
          'Disponibilité en temps réel',
          'Planning d’entretien',
          'Historique des locations',
          'Photos et documents',
        ],
      },
      {
        ic: '📅',
        n: 'Réservations',
        fs: [
          'Calendrier de disponibilités',
          'Contrats numériques',
          'États des lieux entrée/sortie',
          'Acomptes et caution',
          'Confirmation SMS / email',
        ],
      },
      {
        ic: '💳',
        n: 'Paiements',
        fs: [
          'Orange Money, MTN, Wave',
          'Factures PDF',
          'Suivi des impayés',
          'Rapports de caisse',
          'Paiement espèces option',
        ],
      },
      {
        ic: '📊',
        n: 'Pilotage',
        fs: [
          'Taux d’occupation de la flotte',
          'CA par véhicule',
          'Coûts d’entretien',
          'Tableau de bord direction',
          'Export Excel / PDF',
        ],
      },
    ],
  },
  'cms-clinique': {
    catalogId: 'cms-clinique',
    s: 'health',
    ic: '🏥',
    c: '#2FB5A0',
    sg: 'Santé',
    badge: null,
    users: 41,
    rating: 4.8,
    tl: 'Dossiers patients, rendez-vous, ordonnances et stock de médicaments gérés sans erreur.',
    incl: [
      ['👤', 'Dossiers patients'],
      ['📅', 'Agenda médical'],
      ['💊', 'Stock pharmacie'],
      ['📋', 'Ordonnances num.'],
      ['📊', 'Statistiques méd.'],
      ['🔒', 'Données sécurisées'],
      ['📱', 'App médecins'],
      ['📄', 'Rapports épidémio'],
    ],
    dash: {
      title: 'CMS Clinique — Tableau de bord',
      stats: [
        { v: '8', l: "Consultations aujourd'hui" },
        { v: '23', l: 'RDV cette semaine' },
        { v: '97%', l: 'Stock médicaments OK' },
      ],
      bars: [50, 65, 70, 80, 55, 75, 85, 70, 65, 80, 72, 88],
      rows: [
        { n: 'Dr. Koné — 3 consultations', v: 'En cours', c: '#2FB5A0' },
        { n: 'Stock Amoxicilline', v: '12 boîtes restantes', c: '#E8961E' },
        { n: 'Prochain RDV', v: '14h30 — M. Traoré', c: '#4A7FB5' },
      ],
    },
    modules: [
      {
        ic: '👤',
        n: 'Patients',
        fs: [
          'Dossier médical complet et sécurisé',
          'Historique des consultations et prescriptions',
          'Antécédents et allergies trackés',
          'Partage de dossier entre praticiens',
          'Recherche rapide par nom ou dossier',
        ],
      },
      {
        ic: '📅',
        n: 'Agenda',
        fs: [
          'Prise de rendez-vous en ligne',
          'Planning par médecin ou cabinet',
          'Rappels automatiques par SMS',
          'Gestion des annulations',
          "File d'attente en temps réel",
        ],
      },
      {
        ic: '💊',
        n: 'Pharmacie',
        fs: [
          'Inventaire médicaments en temps réel',
          'Alertes de péremption et rupture',
          'Ordonnances numérisées et archivées',
          'Déstockage automatique à la dispensation',
          'Rapports de consommation mensuels',
        ],
      },
      {
        ic: '📊',
        n: 'Rapports',
        fs: [
          "Statistiques d'activité du cabinet",
          'Rapports épidémiologiques mensuels',
          "Suivi du chiffre d'affaires médical",
          'Tableau de bord direction',
          'Export pour les organismes de santé',
        ],
      },
    ],
  },
  'crm-boutique': {
    catalogId: 'crm-boutique',
    s: 'boutique',
    ic: '🛍️',
    c: '#9C6FE4',
    sg: 'Boutique',
    badge: null,
    users: 29,
    rating: 4.7,
    tl: 'Clients, fidélité, ventes omnicanal et suivi des commandes pour commerces de détail.',
    incl: [
      ['🛍️', 'Catalogue produits'],
      ['💰', 'Caisse intégrée'],
      ['❤️', 'Programme fidélité'],
      ['📦', 'Gestion inventaire'],
      ['📊', 'Rapports ventes'],
      ['📱', 'App boutique'],
      ['🔗', 'Vente en ligne'],
      ['📸', 'Galerie produits'],
    ],
    dash: {
      title: 'CRM Boutique — Tableau de bord',
      stats: [
        { v: '324 000', l: 'Ventes ce mois (FCFA)' },
        { v: '47', l: 'Produits en stock' },
        { v: '128', l: 'Clients fidèles' },
      ],
      bars: [40, 60, 50, 80, 65, 70, 85, 75, 60, 78, 82, 90],
      rows: [
        { n: 'Tissu Wax — Collection printemps', v: '23 unités', c: '#9C6FE4' },
        { n: 'Sculpture Baoulé', v: '8 unités', c: '#C9A44A' },
        { n: 'Sac cuir tressé', v: '15 unités', c: '#2EB464' },
      ],
    },
    modules: [
      {
        ic: '🛍️',
        n: 'Catalogue',
        fs: [
          'Fiches produits avec photos',
          'Gestion des variantes (taille, couleur)',
          'Codes-barres et QR codes',
          'Catégories et collections',
          'Mise en avant et promotions',
        ],
      },
      {
        ic: '💰',
        n: 'Ventes',
        fs: [
          'Caisse rapide et intuitive',
          'Paiement espèces et Mobile Money',
          'Reçus numériques automatiques',
          'Remises et promotions',
          'Historique de toutes les ventes',
        ],
      },
      {
        ic: '❤️',
        n: 'Fidélité',
        fs: [
          'Programme de points personnalisable',
          'Cartes de fidélité numériques',
          'Cadeaux et récompenses automatiques',
          'Anniversaires et offres spéciales',
          'Rapport clients les plus fidèles',
        ],
      },
      {
        ic: '📊',
        n: 'Analyse',
        fs: [
          'Top produits et collections',
          'Rapport de ventes hebdomadaire',
          'Marges et rentabilité',
          'Saisonnalité des ventes',
          'Comparaison mois sur mois',
        ],
      },
    ],
  },
  'erp-immobiliere': {
    catalogId: 'erp-immobiliere',
    s: 'immobilier',
    ic: '🏠',
    c: '#6EA7EA',
    sg: 'Immobilier',
    badge: null,
    users: 37,
    rating: 4.7,
    tl: 'Biens, mandats, baux, quittances de loyer et tableau de bord propriétaires.',
    incl: [
      ['🏠', 'Gestion des biens'],
      ['📄', 'Baux & quittances'],
      ['📅', 'Visites & mandats'],
      ['💰', 'Suivi loyers'],
      ['📊', 'Rentabilité'],
      ['🔔', 'Relances auto'],
      ['👥', 'Portail locataire'],
      ['📱', 'Accès mobile'],
    ],
    dash: {
      title: 'ERP Immobilière — Tableau de bord',
      stats: [
        { v: '86', l: 'Biens gérés' },
        { v: '92%', l: 'Taux d’occupation' },
        { v: '4', l: 'Loyers en retard' },
      ],
      bars: [55, 70, 65, 80, 75, 85, 70, 90, 78, 82, 88, 92],
      rows: [
        { n: 'Appart. Cocody — Bail #92', v: 'Loyer reçu', c: '#2EB464' },
        { n: 'Villa Riviera', v: 'Visite 16h', c: '#6EA7EA' },
        { n: 'Studio Plateau', v: 'Impayé J+7', c: '#E8961E' },
      ],
    },
    modules: [
      {
        ic: '🏠',
        n: 'Biens',
        fs: [
          'Fiches bien avec photos et statut',
          'Disponible, loué, en travaux',
          'Historique des locataires',
          'Documents associés',
          'Multi-portefeuilles',
        ],
      },
      {
        ic: '📄',
        n: 'Baux',
        fs: [
          'Génération de baux PDF',
          'Échéanciers de loyers',
          'Quittances automatiques',
          'Indexation et avenants',
          'Archivage numérique',
        ],
      },
      {
        ic: '💰',
        n: 'Encaissements',
        fs: [
          'Suivi des loyers et charges',
          'Relances automatiques',
          'Mobile Money intégré',
          'Rapports propriétaires',
          'Cash-flow par bien',
        ],
      },
      {
        ic: '📊',
        n: 'Pilotage',
        fs: [
          'Taux d’occupation',
          'Impayés consolidés',
          'Rentabilité par bien',
          'Tableau de bord direction',
          'Export Excel / PDF',
        ],
      },
    ],
  },
  'erp-gestion-stock': {
    catalogId: 'erp-gestion-stock',
    s: 'stock',
    ic: '📦',
    c: '#2EB464',
    sg: 'Stock',
    badge: null,
    users: 45,
    rating: 4.8,
    tl: 'Entrées, sorties, inventaires, alertes seuil et traçabilité multi-dépôts.',
    incl: [
      ['📦', 'Multi-dépôts'],
      ['🔔', 'Alertes seuil'],
      ['📱', 'Inventaire mobile'],
      ['📊', 'Valorisation live'],
      ['🔄', 'Transferts'],
      ['🧾', 'Mouvements'],
      ['🏷️', 'Lots / séries'],
      ['📈', 'Rapports'],
    ],
    dash: {
      title: 'ERP Stock — Tableau de bord',
      stats: [
        { v: '1 240', l: 'Références actives' },
        { v: '8', l: 'Alertes rupture' },
        { v: '3', l: 'Dépôts' },
      ],
      bars: [45, 60, 55, 75, 70, 80, 65, 85, 72, 78, 88, 90],
      rows: [
        { n: 'Huile 5L — Dépôt Yopougon', v: 'Sous seuil', c: '#E8961E' },
        { n: 'Transfert Cocody → Plateau', v: 'En cours', c: '#4A7FB5' },
        { n: 'Inventaire zone A', v: 'OK', c: '#2EB464' },
      ],
    },
    modules: [
      {
        ic: '📦',
        n: 'Multi-dépôts',
        fs: [
          'Stock consolidé multi-sites',
          'Transferts inter-dépôts',
          'Valorisation en temps réel',
          'Seuils par dépôt',
          'Historique des mouvements',
        ],
      },
      {
        ic: '📱',
        n: 'Inventaire',
        fs: [
          'Comptage guidé sur mobile',
          'Écarts et rapprochement',
          'Codes-barres / QR',
          'Inventaire partiel par zone',
          'Validation multi-utilisateurs',
        ],
      },
      {
        ic: '🔔',
        n: 'Alertes',
        fs: [
          'Seuils de rupture configurables',
          'Suggestions de réappro',
          'Notifications SMS / email',
          'Péremption (si applicable)',
          'Tableau des urgences',
        ],
      },
      {
        ic: '📊',
        n: 'Reporting',
        fs: [
          'Rotation des stocks',
          'Top entrées / sorties',
          'Valorisation mensuelle',
          'Export Excel / PDF',
          'Pilotage direction',
        ],
      },
    ],
  },
  'erp-gestion-evenementielle': {
    catalogId: 'erp-gestion-evenementielle',
    s: 'events',
    ic: '🎉',
    c: '#E8961E',
    sg: 'Événementiel',
    badge: 'Nouveau',
    users: 22,
    rating: 4.6,
    tl: 'Planning, invités, prestataires, budget et billetterie pour vos événements.',
    incl: [
      ['📅', 'Planning'],
      ['🎫', 'Billetterie'],
      ['👥', 'Invités'],
      ['💰', 'Budget'],
      ['🤝', 'Prestataires'],
      ['📊', 'Reporting'],
      ['📱', 'Check-in'],
      ['🧾', 'Facturation'],
    ],
    dash: {
      title: 'ERP Événementiel — Tableau de bord',
      stats: [
        { v: '3', l: 'Événements en cours' },
        { v: '420', l: 'Invités confirmés' },
        { v: '78%', l: 'Budget consommé' },
      ],
      bars: [35, 50, 60, 70, 55, 80, 75, 85, 68, 72, 88, 90],
      rows: [
        { n: 'Gala Noya — Billetterie', v: '312 / 400', c: '#E8961E' },
        { n: 'Traiteur — Acompte', v: 'Payé', c: '#2EB464' },
        { n: 'Check-in salle A', v: 'Ouvert 18h', c: '#4A7FB5' },
      ],
    },
    modules: [
      {
        ic: '📅',
        n: 'Planning',
        fs: [
          'Calendrier multi-événements',
          'Salles et ressources',
          'Timeline jour J',
          'Affectation équipe',
          'Rappels automatiques',
        ],
      },
      {
        ic: '🎫',
        n: 'Billetterie',
        fs: [
          'Types de billets et tarifs',
          'Vente en ligne',
          'QR codes check-in',
          'Liste d’invités',
          'Statistiques de remplissage',
        ],
      },
      {
        ic: '💰',
        n: 'Budget',
        fs: [
          'Postes de dépenses',
          'Suivi vs prévisionnel',
          'Prestataires et acomptes',
          'Facturation client',
          'Bilan post-événement',
        ],
      },
      {
        ic: '📊',
        n: 'Pilotage',
        fs: [
          'Tableau de bord temps réel',
          'ROI par événement',
          'Export rapports',
          'Comparaison d’éditions',
          'Vue direction',
        ],
      },
    ],
  },
};

const FALLBACK_COLORS = ['#E8961E', '#4A7FB5', '#2EB464', '#9C6FE4', '#E05252', '#C9A44A'];

function fallbackMarketing(app: AppCatalogEntry, index: number): BoutiqueMarketing {
  const c = FALLBACK_COLORS[index % FALLBACK_COLORS.length] ?? '#E8961E';
  return {
    catalogId: app.id,
    s: 'commerce',
    ic: '💻',
    c,
    sg: 'Logiciel',
    badge: null,
    users: 10,
    rating: 4.5,
    tl: app.desc,
    incl: [
      ['☁️', 'Hébergement SaaS'],
      ['🏠', 'Licence auto-hébergée'],
      ['📱', 'Accès multi-appareils'],
      ['💬', 'Support français'],
    ],
    dash: {
      title: `${app.title} — Aperçu`,
      stats: [
        { v: '—', l: 'Indicateur 1' },
        { v: '—', l: 'Indicateur 2' },
        { v: '—', l: 'Indicateur 3' },
      ],
      bars: [40, 55, 50, 70, 60, 75, 65, 80, 70, 78, 85, 90],
      rows: [
        { n: 'Module principal', v: 'Actif', c },
        { n: 'Synchronisation', v: 'OK', c: '#2EB464' },
        { n: 'Support', v: 'Inclus', c: '#4A7FB5' },
      ],
    },
    modules: (app.features?.length
      ? app.features.map((f) => ({
          ic: '✨',
          n: f.title,
          fs: [f.description],
        }))
      : [
          {
            ic: '✨',
            n: 'Fonctionnalités',
            fs: app.advantages?.length ? app.advantages : [app.desc],
          },
        ]) as BoutiqueModule[],
  };
}

export function resolveCatalogPrices(app: AppCatalogEntry): {
  monthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  annualTotalPrice: number | null;
  licPrice: number | null;
} {
  const monthSub = app.pricing.find((p) => p.type === 'subscription' && p.billingCycle === 'month');
  const yearSub = app.pricing.find((p) => p.type === 'subscription' && p.billingCycle === 'year');
  const lic = app.pricing.find((p) => p.type === 'license');
  const monthlyPrice = monthSub?.price ?? null;
  const annualTotalPrice =
    yearSub?.price ?? (monthlyPrice != null ? Math.round(monthlyPrice * 0.8 * 12) : null);
  const annualMonthlyPrice =
    annualTotalPrice != null ? Math.round(annualTotalPrice / 12) : null;
  return {
    monthlyPrice,
    annualMonthlyPrice,
    annualTotalPrice,
    licPrice: lic ? lic.price : null,
  };
}

export function buildBoutiqueProducts(catalog: AppCatalogEntry[]): BoutiqueProduct[] {
  return catalog
    .filter((a) => a.onlineCheckout && a.pricing.length > 0)
    .map((app, index) => {
      const marketing = MARKETING_BY_CATALOG_ID[app.id] ?? fallbackMarketing(app, index);
      const prices = resolveCatalogPrices(app);
      return {
        ...marketing,
        id: app.id,
        n: app.title,
        desc: app.longDescription?.trim() || app.desc,
        ...prices,
        demoUrl: resolveAppDemoUrl(app),
        whatsappNumber: app.whatsappNumber?.trim() || null,
        whatsappMessage: app.whatsappMessage?.trim() || null,
      };
    });
}

export function formatBoutiqueFcfa(n: number): string {
  return n.toLocaleString('fr-FR');
}

export function productFromPrice(p: BoutiqueProduct): number | null {
  return p.monthlyPrice ?? p.licPrice;
}

export function sortBoutiqueProducts(
  products: BoutiqueProduct[],
  sort: BoutiqueSort,
): BoutiqueProduct[] {
  const list = [...products];
  switch (sort) {
    case 'popularity':
      return list.sort((a, b) => b.users - a.users);
    case 'price-asc':
      return list.sort((a, b) => {
        const pa = productFromPrice(a);
        const pb = productFromPrice(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      });
    case 'rating':
      return list.sort((a, b) => b.rating - a.rating);
    case 'new':
      return list.sort((a, b) => {
        const an = a.badge === 'Nouveau' ? 1 : 0;
        const bn = b.badge === 'Nouveau' ? 1 : 0;
        return bn - an;
      });
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
}

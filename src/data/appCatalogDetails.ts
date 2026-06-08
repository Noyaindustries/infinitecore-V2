import type { AppCatalogDetailFields } from './appCatalog';

const WHATSAPP = '2250103015467';

function detail(partial: AppCatalogDetailFields): AppCatalogDetailFields {
  return {
    whatsappNumber: WHATSAPP,
    ...partial,
    galleryImages: partial.galleryImages?.length ? partial.galleryImages : [],
  };
}

/** Contenu page détail par défaut — fusionné avec le catalogue stocké en base. */
export const APP_CATALOG_DETAIL_DEFAULTS: Record<string, AppCatalogDetailFields> = {
  'erp-multi-ecole': detail({
    longDescription:
      'Pilotez plusieurs établissements scolaires depuis une seule plateforme : inscriptions, notes, bulletins, frais de scolarité et communication parents.',
    problem:
      'Vos données scolaires sont éparpillées entre cahiers, Excel et groupes WhatsApp. Les frais impayés ne sont pas suivis et chaque établissement travaille en silo.',
    advantages: [
      'Vue consolidée multi-écoles en temps réel',
      'Réduction des impayés grâce aux relances automatiques',
      'Bulletins et emplois du temps générés en un clic',
      'Accès parents sécurisé (notes, absences, paiements)',
    ],
    features: [
      { title: 'Multi-établissements', description: 'Gérez plusieurs campus avec des rôles direction, enseignant et comptabilité.' },
      { title: 'Scolarité & notes', description: 'Saisie des notes, moyennes, bulletins PDF et historique par élève.' },
      { title: 'Frais & encaissements', description: 'Échéanciers, reçus, suivi Wave/Orange Money et rapports de trésorerie.' },
      { title: 'Emplois du temps', description: 'Planning par classe, salles et enseignants avec export partageable.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo de ERP Multi-École Infinite Core.',
    galleryImages: ['/apps/erp-multi-ecole.svg'],
  }),
  'caisse-enregistreuse': detail({
    longDescription:
      'Encaissez rapidement en boutique, éditez des tickets, suivez vos ventes et synchronisez avec votre stock et votre comptabilité.',
    problem:
      'La caisse ne communique pas avec le stock. Les écarts de fin de journée s\'accumulent et vous ne savez pas quel produit rapporte vraiment.',
    advantages: [
      'Encaissement rapide même en connexion instable',
      'Tickets et reçus conformes',
      'Rapports de caisse par vendeur et par point de vente',
      'Intégration Wave / Orange Money',
    ],
    features: [
      { title: 'Point de vente', description: 'Interface tactile, recherche produit, remises et modes de paiement multiples.' },
      { title: 'Tickets & reçus', description: 'Impression ou envoi PDF/WhatsApp au client.' },
      { title: 'Clôture de caisse', description: 'Écarts, fonds de caisse et historique par session.' },
      { title: 'Tableau de bord', description: 'CA journalier, top produits et marge en temps réel.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo de la Caisse enregistreuse Infinite Core.',
    galleryImages: ['/apps/caisse-enregistreuse.svg'],
  }),
  'erp-immobiliere': detail({
    longDescription:
      'Centralisez biens, mandats, baux, quittances et relances loyers pour agences et propriétaires multi-biens.',
    problem:
      'Les baux sont dans des dossiers papier, les quittances sont faites à la main et les loyers impayés sont découverts trop tard.',
    advantages: [
      'Pipeline biens → mandat → bail automatisé',
      'Quittances et relances en un clic',
      'Portail propriétaire et locataire',
      'Tableau de bord de rentabilité par bien',
    ],
    features: [
      { title: 'Gestion des biens', description: 'Fiches bien, photos, statut (disponible, loué, en travaux).' },
      { title: 'Baux & quittances', description: 'Génération automatique, échéanciers et indexation.' },
      { title: 'Mandats & visites', description: 'Suivi commercial et calendrier des visites.' },
      { title: 'Reporting', description: 'Taux d\'occupation, impayés et cash-flow par portefeuille.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo de l\'ERP immobilière Infinite Core.',
    galleryImages: ['/apps/erp-immobiliere.svg'],
  }),
  'erp-gestion-stock': detail({
    longDescription:
      'Maîtrisez vos stocks multi-dépôts : entrées, sorties, inventaires, seuils d\'alerte et traçabilité complète.',
    problem:
      'Les ruptures et surstocks coexistent faute de visibilité. Les inventaires sont longs et les écarts inexpliqués.',
    advantages: [
      'Alertes seuil par produit et par dépôt',
      'Traçabilité lot / série',
      'Inventaires guidés sur mobile',
      'Valorisation stock en temps réel',
    ],
    features: [
      { title: 'Multi-dépôts', description: 'Transferts inter-sites et stock consolidé.' },
      { title: 'Mouvements', description: 'Entrées fournisseur, sorties vente, ajustements et casse.' },
      { title: 'Inventaire', description: 'Comptage par zone, écarts et rapprochement automatique.' },
      { title: 'Alertes', description: 'Notifications rupture et réapprovisionnement suggéré.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo de l\'ERP gestion de stock Infinite Core.',
    galleryImages: ['/apps/erp-gestion-stock.svg'],
  }),
  'erp-gestion-evenementielle': detail({
    longDescription:
      'Organisez événements professionnels ou culturels : planning, invités, prestataires, budget et billetterie.',
    problem:
      'Les prestataires et invités sont gérés sur des fichiers séparés. Le budget dérape sans suivi centralisé.',
    advantages: [
      'Planning unifié équipe + prestataires',
      'Billetterie et contrôle d\'accès',
      'Budget vs réalisé en direct',
      'Check-list jour J sur mobile',
    ],
    features: [
      { title: 'Planning', description: 'Timeline, tâches, responsables et rappels.' },
      { title: 'Invités & RSVP', description: 'Listes, segments, confirmations et badges.' },
      { title: 'Prestataires', description: 'Contrats, paiements échelonnés et livrables.' },
      { title: 'Billetterie', description: 'Tarifs, codes promo et suivi des ventes.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo de l\'ERP gestion événementielle Infinite Core.',
    galleryImages: ['/apps/erp-gestion-evenementielle.svg'],
  }),
  'crm-boutique': detail({
    longDescription:
      'Fidélisez vos clients retail : historique d\'achats, programmes de fidélité, campagnes et suivi omnicanal.',
    problem:
      'Vous ne connaissez pas vos meilleurs clients. Les promotions sont envoyées au hasard et le panier moyen stagne.',
    advantages: [
      'Fiche client 360° (achats, préférences, réclamations)',
      'Campagnes SMS / WhatsApp ciblées',
      'Programme fidélité intégré',
      'Synchronisation caisse & e-commerce',
    ],
    features: [
      { title: 'Base clients', description: 'Segmentation RFM, tags et historique complet.' },
      { title: 'Fidélité', description: 'Points, cartes et offres personnalisées.' },
      { title: 'Ventes', description: 'Panier, commandes en ligne et suivi livraison.' },
      { title: 'Marketing', description: 'Campagnes, taux d\'ouverture et ROI simplifié.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo du CRM Boutique Infinite Core.',
    galleryImages: ['/apps/crm-boutique.svg'],
  }),
  'app-location-voiture': detail({
    longDescription:
      'Gérez votre flotte de location : réservations, contrats, états des lieux, maintenance et facturation.',
    problem:
      'Les réservations arrivent par téléphone et WhatsApp sans calendrier unique. Les véhicules sont double-bookés.',
    advantages: [
      'Calendrier flotte en temps réel',
      'Contrats et cautions numériques',
      'États des lieux photo à l\'entrée/sortie',
      'Maintenance et alertes assurance',
    ],
    features: [
      { title: 'Réservations', description: 'Disponibilité, tarifs saisonniers et options.' },
      { title: 'Contrats', description: 'Génération PDF, signature et archivage.' },
      { title: 'États des lieux', description: 'Photos, kilométrage et dommages tracés.' },
      { title: 'Facturation', description: 'Extras, pénalités et encaissement multi-canal.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo de l\'application location voiture Infinite Core.',
    galleryImages: ['/apps/app-location-voiture.svg'],
  }),
  'cms-clinique': detail({
    longDescription:
      'Site vitrine médical, prise de rendez-vous en ligne, dossiers patients et téléconsultation pour cliniques modernes.',
    problem:
      'Les patients appellent pour un créneau déjà pris. Le site est obsolète et les dossiers sont fragmentés.',
    advantages: [
      'Prise de RDV 24h/24 sans secrétariat saturé',
      'Site conforme et rassurant pour les patients',
      'Dossier patient centralisé',
      'Téléconsultation intégrée',
    ],
    features: [
      { title: 'Site vitrine', description: 'Pages médecins, spécialités, horaires et FAQ.' },
      { title: 'Agenda RDV', description: 'Créneaux, rappels SMS/WhatsApp et liste d\'attente.' },
      { title: 'Dossier patient', description: 'Antécédents, ordonnances et documents sécurisés.' },
      { title: 'Téléconsultation', description: 'Lien de visio et compte-rendu archivé.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo du CMS Clinique Infinite Core.',
    galleryImages: ['/apps/cms-clinique.svg'],
  }),
  'crm-multi-hotel': detail({
    longDescription:
      'Pilotez plusieurs hôtels : chambres, réservations, housekeeping, tarifs et performance par établissement.',
    problem:
      'Les réservations Booking et direct ne sont pas synchronisées. Le housekeeping découvre les départs tardivement.',
    advantages: [
      'Calendrier chambres multi-hôtels',
      'Housekeeping mobile en temps réel',
      'Tarification dynamique par saison',
      'Reporting occupation & RevPAR',
    ],
    features: [
      { title: 'Réservations', description: 'Channel manager simplifié et walk-in.' },
      { title: 'Chambres', description: 'Statuts propre / sale / maintenance / occupée.' },
      { title: 'Housekeeping', description: 'Tâches assignées et contrôle qualité.' },
      { title: 'Multi-établissements', description: 'KPI consolidés et comparaison par site.' },
    ],
    demoUrl: '',
    whatsappMessage: 'Bonjour, je souhaite une démo du CRM Multi-Hôtel Infinite Core.',
    galleryImages: ['/apps/crm-multi-hotel.svg'],
  }),
};

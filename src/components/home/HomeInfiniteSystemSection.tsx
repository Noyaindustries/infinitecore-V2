import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Palette,
  Server,
  Satellite,
  Users,
  GraduationCap,
  Puzzle,
  Globe2,
  Link2,
  ShieldCheck,
  Building2,
  Landmark,
  Building,
  Globe,
  School,
  Hospital,
  type LucideIcon,
} from 'lucide-react';
import HomeSectionLabel from './HomeSectionLabel';
import { homeContainerVariants, homeItemVariants } from './homeMotion';

const AUDIENCES: { Icon: LucideIcon; text: string; accent: 'blue' | 'gold' }[] = [
  { Icon: Landmark, text: 'Institutions publiques', accent: 'blue' },
  { Icon: Building2, text: 'Grandes entreprises', accent: 'gold' },
  { Icon: Building, text: 'Groupes financiers', accent: 'blue' },
  { Icon: Globe, text: 'Multinationales africaines', accent: 'gold' },
  { Icon: School, text: 'Universités et écoles', accent: 'blue' },
  { Icon: Hospital, text: 'Établissements de santé', accent: 'gold' },
];

const ROLES = [
  { label: 'ADMIN', tone: 'home-role-gold', desc: 'Contrôle total', tag: 'Tout' },
  { label: 'DIRECTION', tone: 'home-role-blue', desc: 'KPIs + validation', tags: ['Lecture', 'Rapports'] },
  { label: 'OPÉRATIONS', tone: 'home-role-green', desc: 'CRM + Projects', tags: ['Écriture'] },
  { label: 'PARTENAIRES', tone: 'home-role-purple', desc: 'Vue limitée', tag: 'Referral' },
] as const;

const ENTERPRISE_STRIP = [
  { Icon: GraduationCap, title: 'Formation & Change Management', desc: 'Programme sur mesure pour vos équipes. Sessions à Abidjan ou en ligne. Certification Infinite System pour vos administrateurs.' },
  { Icon: Puzzle, title: 'Modules Sur Mesure', desc: 'Nous développons des modules spécifiques à votre secteur et les intégrons nativement dans votre Infinite System.', badge: 'Développement illimité' },
  { Icon: Globe2, title: 'Multi-Sites & Multi-Entités', desc: 'Gérez filiales, agences et départements depuis un seul panneau. Consolidation, reporting unifié, gouvernance centralisée.' },
  { Icon: Link2, title: 'API Complète & Webhooks', desc: 'API REST documentée. Webhooks temps réel. Connectez votre ERP, BI ou systèmes legacy.', code: true },
  { Icon: ShieldCheck, title: 'Conformité & Audit', desc: 'Audit logs complets. Conformité loi ivoirienne n°2013-450, OHADA, CNPS. Rapport généré pour vos auditeurs.' },
] as const;

function EnterpriseIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <div className="home-enterprise-icon">
      <Icon className="h-5 w-5 text-text-primary" aria-hidden />
    </div>
  );
}

export default function HomeInfiniteSystemSection() {
  return (
    <section id="system" className="home-system-section relative z-10 border-t border-white/5 py-16 md:py-28">
      <div className="home-system-aurora pointer-events-none absolute inset-0" aria-hidden />

      <div className="container relative mx-auto max-w-[1040px] px-6">
        <div className="mb-12 text-center">
          <HomeSectionLabel accent="blue" centered variant="pill" className="mb-6">
            Infinite System
          </HomeSectionLabel>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="home-section-title mx-auto max-w-3xl"
          >
            Personnalisation sur mesure et{' '}
            <span className="home-text-gradient-gold">illimitée</span>
            <br />
            pour les{' '}
            <span className="home-text-gradient-blue">grandes entreprises et institutions.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg"
          >
            Infinite System est la couche enterprise d&apos;Infinite Core. Infrastructure dédiée, white label intégral, modules sur mesure et intégrations illimitées — pour les organisations qui n&apos;acceptent pas les compromis.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {AUDIENCES.map(({ Icon, text, accent }) => (
              <div key={text} className={`home-audience-pill home-audience-pill--${accent}`}>
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span>{text}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="flex flex-col gap-4">
          <motion.div
            variants={homeContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {/* White label — colonne principale */}
            <motion.article
              variants={homeItemVariants}
              className="home-enterprise-card md:col-start-1 md:row-span-2"
            >
              <EnterpriseIcon Icon={Palette} />
              <h3 className="home-enterprise-title">White Label Intégral</h3>
              <p className="home-enterprise-desc">
                Votre marque, vos couleurs, votre domaine. Vos clients voient votre identité — pas celle de Noya. Du logo aux emails transactionnels, tout est à votre image.
              </p>
              <span className="home-enterprise-badge">Personnalisation 100% illimitée</span>
              <div className="home-whitelabel-mock mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="home-whitelabel-logo">VOTRE LOGO</span>
                  <span className="text-[9px] text-text-dim">votre-plateforme.ci</span>
                </div>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-2 rounded bg-surface-elevated" />
                  ))}
                </div>
                <div className="flex h-14 items-end gap-1.5 rounded-lg border border-white/5 bg-surface-tertiary p-2">
                  {[30, 50, 40, 70, 60, 90].map((h, i) => (
                    <div
                      key={i}
                      className="w-full rounded-t-sm bg-noya-orange"
                      style={{ height: `${h}%`, opacity: 0.35 + i * 0.1 }}
                    />
                  ))}
                </div>
              </div>
            </motion.article>

            <div className="grid grid-cols-1 gap-3 md:col-start-2 md:row-start-1 md:grid-cols-2">
              <motion.article variants={homeItemVariants} className="home-enterprise-card home-enterprise-card--compact">
                <EnterpriseIcon Icon={Server} />
                <h3 className="home-enterprise-title text-base md:text-lg">Infrastructure Dédiée</h3>
                <p className="home-enterprise-desc text-xs">
                  VPS isolé, cloud privé ou on-premise. Aucun partage de ressources avec d&apos;autres clients.
                </p>
                <div className="home-code-block mt-3 text-[9px]">
                  <p><span className="text-noya-green">server:</span> <span className="text-noya-orange">VPS-DÉDIÉ</span></p>
                  <p><span className="text-noya-green">region:</span> <span className="text-noya-orange">Abidjan</span></p>
                  <p><span className="text-noya-green">isolation:</span> <span className="text-[#6EA7EA]">COMPLÈTE</span></p>
                  <p><span className="text-noya-green">backup:</span> <span className="text-noya-orange">2h</span></p>
                </div>
              </motion.article>

              <motion.article variants={homeItemVariants} className="home-enterprise-card home-enterprise-card--compact">
                <EnterpriseIcon Icon={Satellite} />
                <h3 className="home-enterprise-title text-base md:text-lg">SLA 99.9%</h3>
                <p className="home-enterprise-desc text-xs">SLA contractuel, monitoring 24/7, intervention sous 4 h.</p>
                <div className="mt-3 rounded-lg border border-white/5 bg-black/30 p-3">
                  <p className="text-2xl font-black text-noya-green">99.9%</p>
                  <p className="mb-2 text-[8px] font-bold uppercase tracking-wide text-text-muted">Uptime garanti</p>
                  <div className="h-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-[99.9%] rounded-full bg-noya-green" />
                  </div>
                </div>
              </motion.article>
            </div>

            <motion.article variants={homeItemVariants} className="home-enterprise-card md:col-start-2 md:row-start-2">
              <EnterpriseIcon Icon={Users} />
              <h3 className="home-enterprise-title text-base md:text-lg">Rôles et Permissions Illimités</h3>
              <p className="home-enterprise-desc text-xs">Rôles illimités, permissions fines, SSO / LDAP.</p>
              <div className="mt-3 space-y-1.5">
                {ROLES.map((role) => (
                  <div key={role.label} className="home-role-row">
                    <span className={`home-role-badge ${role.tone}`}>{role.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-text-secondary">{role.desc}</span>
                    <div className="flex shrink-0 gap-1">
                      {'tag' in role && role.tag && (
                        <span className="home-role-tag">{role.tag}</span>
                      )}
                      {'tags' in role &&
                        role.tags?.map((t) => (
                          <span key={t} className="home-role-tag">
                            {t}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.article>
          </motion.div>

          <motion.div
            variants={homeContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            {ENTERPRISE_STRIP.map(({ Icon, title, desc, ...rest }) => (
              <motion.article
                key={title}
                variants={homeItemVariants}
                className="home-enterprise-card home-enterprise-card--strip flex flex-col"
              >
                <EnterpriseIcon Icon={Icon} />
                <h3 className="home-enterprise-title text-sm leading-tight">{title}</h3>
                <p className="home-enterprise-desc mt-2 flex-1 text-[11px] leading-relaxed">{desc}</p>
                {'badge' in rest && rest.badge && (
                  <span className="home-enterprise-badge mt-3 text-[9px]">{rest.badge}</span>
                )}
                {'code' in rest && rest.code && (
                  <div className="home-code-block mt-3 text-[9px]">
                    <p><span className="text-[#6EA7EA]">GET</span> <span className="text-text-primary">/api/v1/clients</span></p>
                    <p><span className="text-noya-orange">POST</span> <span className="text-text-primary">/api/v1/invoices</span></p>
                  </div>
                )}
              </motion.article>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="home-enterprise-cta mt-10"
        >
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-black text-text-primary sm:text-2xl">
                Discutons de votre projet{' '}
                <span className="home-text-gradient-blue">Enterprise.</span>
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary md:text-[15px]">
                Notre équipe analyse votre structure et vous propose une architecture Infinite System sur mesure. Aucun engagement pour la première consultation.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[240px]">
              <Link to="/contact" className="home-btn-enterprise group">
                Demander une démo Enterprise
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link to="/tarifs" className="home-link-muted justify-center">
                Voir les plans et tarifs
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

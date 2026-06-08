import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import HomeSideNavBars from '../components/HomeSideNavBars';
import HomeAppCatalogSection from '../components/HomeAppCatalogSection';
import HomeHero from '../components/home/HomeHero';
import HomeSectionLabel from '../components/home/HomeSectionLabel';
import HomeSolutionsSection from '../components/home/HomeSolutionsSection';
import HomeInfiniteSystemSection from '../components/home/HomeInfiniteSystemSection';
import { homeContainerVariants, homeItemVariants } from '../components/home/homeMotion';
import {
  Users,
  MessageSquare,
  Briefcase,
  ArrowRight,
  TrendingUp,
  Check,
  Quote,
  Star,
} from 'lucide-react';

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <>
      {/* Hors du bloc scroll / overflow : évite que overflow-x-hidden ou ancestors ne « coupent » la barre en pleine largeur */}
      <motion.div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[950] h-1 origin-left bg-gradient-to-r from-[#FFB332] via-[#6EA7EA] to-[#FFB332]"
        style={{ scaleX }}
        aria-hidden
      />

      <div
        ref={containerRef}
        className="relative overflow-x-hidden bg-transparent font-[Urbanist,ui-sans-serif,system-ui,sans-serif] text-[#F5F7FF] selection:bg-[#6EA7EA]/30"
      >
      <HomeSideNavBars />

      <HomeHero />


      {/* SECTION LE PROBLÈME */}
      <section id="probleme" className="relative z-10 border-t border-white/5 bg-[#0A1020]/90 py-16 backdrop-blur-sm md:py-24">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="mb-10">
            <HomeSectionLabel accent="gold">Le problème</HomeSectionLabel>
            <h2 className="home-section-title max-w-3xl">
              Votre entreprise mérite mieux que WhatsApp et Excel.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              { icon: MessageSquare, title: 'Vos clients dans WhatsApp', desc: "Impossible de retrouver un historique clair. Chaque relance se perd dans des fils de conversation mélangés — perso et pro à la fois." },
              { icon: TrendingUp, title: 'Votre trésorerie dans Excel', desc: "Vous ne savez jamais combien vous avez en caisse avant que votre comptable rappelle. La visibilité financière n'est pas un luxe." },
              { icon: Users, title: 'Votre équipe sans structure', desc: 'Les décisions se perdent dans des groupes WhatsApp. Personne ne sait qui fait quoi. Les deadlines glissent, les clients s\'impatientent.' },
              { icon: Briefcase, title: 'Vos employés sans outils', desc: "Congés, paie, contrats gérés à la main. L'inspection du travail aujourd'hui vous mettrait en sérieuse difficulté." },
            ].map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                className="home-card group p-8 md:p-10"
              >
                <div className="home-card-icon mb-6">
                  <item.icon className="h-5 w-5 text-text-primary" />
                </div>
                <h3 className="mb-3 text-lg font-bold text-text-primary">{item.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="home-cta-panel mt-14 text-center md:mt-16"
          >
            <h3 className="mb-6 text-2xl font-bold leading-tight text-text-primary md:text-3xl">
              Ces problèmes coûtent chaque jour du temps,<br className="hidden md:block" /> de l&apos;argent et de la crédibilité.
            </h3>
            <p className="text-2xl font-black leading-tight tracking-tight text-noya-orange md:text-[2.5rem]">
              Infinite Core les résout tous — <br className="md:hidden" />
              <span className="text-white md:text-noya-orange">dans un système modulaire et sans limites.</span>
            </p>
          </motion.div>
        </div>
      </section>

      <HomeSolutionsSection />

      <HomeAppCatalogSection />

      <HomeInfiniteSystemSection />

      <section id="temoignages" className="relative z-10 overflow-hidden border-t border-white/5 py-16 md:py-20">
        <div className="container relative z-10 mx-auto max-w-[1200px] px-6">
          <div className="mb-10 text-center">
            <HomeSectionLabel accent="gold" centered>
              Ils nous font confiance
            </HomeSectionLabel>
            <h2 className="home-section-title">Ce que disent nos clients</h2>
          </div>

          <motion.div 
            variants={homeContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { t: "« Avant Infinite Core, je ne savais pas combien j'avais en caisse avant que mon comptable me rappelle. Maintenant je regarde mon tableau de bord le matin comme mon téléphone. »", name: "Kofi A.", role: "CEO — BTP, Cocody", init: "KA", bg: "bg-[#F6A928]" },
              { t: "« Le module CRM a remplacé nos 3 tableaux Excel et notre groupe WhatsApp commercial. Mes commerciaux ont enfin un outil sérieux. »", name: "Awa K.", role: "Responsable commerciale, Import-export", init: "AK", bg: "bg-[#6EA7EA]" },
              { t: "« On a déployé Infinite Core en 5 jours. Le support répond sur WhatsApp le jour même. C'est ça la vraie différence avec les logiciels européens. »", name: "Marc T.", role: "DG — Cabinet conseil, Plateau", init: "MT", bg: "bg-[#2BC673]" }
            ].map((testi, i) => (
              <motion.div key={i} variants={homeItemVariants} className="home-card group relative flex flex-col justify-between p-8 md:p-10">
                <Quote className="pointer-events-none absolute right-8 top-8 h-16 w-16 text-white/5 group-hover:text-noya-orange/10" />
                <div className="mb-6 flex">
                  {[...Array(5)].map((_, idx) => <Star key={idx} className="w-4 h-4 text-[#FFB332] fill-[#FFB332] mr-1" />)}
                </div>
                <p className="text-[#8D98AA] text-[15px] italic leading-relaxed mb-10 min-h-[120px]">
                  {testi.t}
                </p>
                <div className="flex items-center gap-4 mt-auto">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-[#06080D] ${testi.bg}`}>
                    {testi.init}
                  </div>
                  <div>
                    <p className="text-[#F2F4F8] text-[14px] font-bold">{testi.name}</p>
                    <p className="text-[#8D98AA] text-[11px]">{testi.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="tarifs" className="relative z-10 border-t border-white/5 py-16 md:py-20">
        <div className="container mx-auto max-w-[1100px] px-6">
          <div className="mb-10 text-center">
            <HomeSectionLabel accent="gold" centered>
              Tarifs
            </HomeSectionLabel>
            <h2 className="home-section-title text-gradient">Le plan qu&apos;il vous faut.</h2>
          </div>
          
          <motion.div 
            variants={homeContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-stretch"
          >
            
            {/* PACK DÉCOUVERTE (IMAGE 1) */}
            <motion.div variants={homeItemVariants} className="bg-[#0D1320] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col hover:border-white/10 transition-all duration-500 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFB332]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col h-full">
                <span className="text-[#8D98AA] text-[9px] font-bold tracking-[0.15em] uppercase mb-1 block">PACK DÉCOUVERTE</span>
                <h3 className="text-xl font-black text-white mb-1 leading-tight">Démarrer</h3>
                <p className="text-[#8D98AA] text-[12px] md:text-[13px] mb-3 leading-snug min-h-0">Pour structurer votre première solution clé.</p>
                
                <div className="bg-[#0A1020] border border-[#FFB332]/20 rounded-lg px-3 py-2 flex items-center gap-2 mb-3 shadow-inner shadow-[#FFB332]/5">
                  <span className="text-[#2BC673] text-base leading-none">🧩</span>
                  <span className="text-[#F2F4F8] text-[12px] font-bold leading-tight">1 solution configurée</span>
                </div>

                <div className="h-px bg-white/5 w-full mb-3"></div>

                <ul className="space-y-2 mb-4 flex-1 min-h-0">
                  {[
                    '1 module Infinite Core au choix',
                    'Configuration et mise en place',
                    'Formation incluse (1h)',
                    'Support email + mises à jour'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-3.5 h-3.5 rounded border border-[#FFB332]/40 bg-[#FFB332]/10 flex items-center justify-center mt-0.5 shrink-0 shadow-[0_0_6px_rgba(255,179,50,0.08)]">
                        <Check size={9} className="text-[#FFB332]" strokeWidth={4} />
                      </div>
                      <span className="text-[11px] md:text-[12px] text-[#8D98AA] font-medium leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/signup" className="w-full text-center px-3 py-2.5 bg-transparent border border-white/10 hover:bg-white/5 text-[#F2F4F8] font-bold text-xs rounded-lg transition-all mb-1 group/btn">
                  Créer mon compte <span className="inline-block transition-transform group-hover/btn:translate-x-1">&rarr;</span>
                </Link>
                <p className="text-[9px] text-[#8D98AA]/60 text-center italic leading-tight">Prix communiqué après inscription</p>
              </div>
            </motion.div>

            {/* PACK CROISSANCE (IMAGE 3) */}
            <motion.div variants={homeItemVariants} className="bg-[#0D1320] border-2 border-[#1B253D] rounded-2xl p-4 md:p-5 flex flex-col relative shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-10 md:scale-[1.03] group">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#5B89C3] text-white px-3 py-1 rounded-full text-[8px] font-black tracking-[0.08em] uppercase shadow-lg z-20">
                LE PLUS POPULAIRE
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-br from-[#5B89C3]/[0.03] to-transparent opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <span className="text-[#8D98AA] text-[9px] font-bold tracking-[0.15em] uppercase mb-1 block mt-1">PACK CROISSANCE</span>
                <h3 className="text-xl font-black text-white mb-1 leading-tight">Croître</h3>
                <p className="text-[#8D98AA] text-[12px] md:text-[13px] mb-3 leading-snug min-h-0">3 solutions connectées pour PME ambitieuses.</p>
                
                <div className="bg-[#0A1020] border border-[#FFB332]/40 rounded-lg px-3 py-2 flex items-center gap-2 mb-3 shadow-inner shadow-[#FFB332]/10 relative overflow-hidden group/shimmer">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFB332]/10 to-transparent animate-shimmer"></div>
                  <span className="text-[#FFB332] text-base leading-none relative z-10">🚀</span>
                  <span className="text-[#F2F4F8] text-[12px] font-bold leading-tight relative z-10">3 solutions connectées</span>
                </div>

                <div className="h-px bg-white/5 w-full mb-3"></div>

                <ul className="space-y-2 mb-4 flex-1 min-h-0">
                  {[
                    '3 modules Infinite Core connectés',
                    'Onboarding dédié équipe Noya',
                    'Support WhatsApp prioritaire',
                    'Portail client complet'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-3.5 h-3.5 rounded border border-[#FFB332]/40 bg-[#FFB332]/10 flex items-center justify-center mt-0.5 shrink-0 shadow-[0_0_6px_rgba(255,179,50,0.15)]">
                        <Check size={9} className="text-[#FFB332]" strokeWidth={4} />
                      </div>
                      <span className="text-[11px] md:text-[12px] text-[#8D98AA] font-medium leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/signup" className="w-full text-center px-3 py-2.5 bg-[#FFB332] hover:bg-[#F6A928] text-[#06080D] font-black text-xs rounded-lg transition-all shadow-[0_6px_20px_rgba(255,179,50,0.3)] mb-1 hover:scale-[1.01] transform transition-transform group/btn">
                  Créer mon compte <span className="inline-block transition-transform group-hover/btn:translate-x-1">&rarr;</span>
                </Link>
                <p className="text-[9px] text-[#8D98AA]/60 text-center italic leading-tight">Prix communiqué après inscription</p>
              </div>
            </motion.div>

            {/* ENTERPRISE (IMAGE 2) */}
            <motion.div variants={homeItemVariants} className="bg-[#0D1320] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col hover:border-white/10 transition-all duration-500 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5B89C3]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col h-full">
                <span className="text-[#8D98AA] text-[9px] font-bold tracking-[0.15em] uppercase mb-1 block">INFINITE SYSTEM</span>
                <h3 className="text-xl font-black text-white mb-1 leading-tight">Enterprise</h3>
                <p className="text-[#8D98AA] text-[12px] md:text-[13px] mb-3 leading-snug min-h-0">Personnalisation illimitée pour grandes structures.</p>
                
                <div className="bg-[#0A1020] border border-[#5B89C3]/20 rounded-lg px-3 py-2 flex items-center gap-2 mb-3 shadow-inner shadow-[#5B89C3]/5">
                  <span className="text-[#5B89C3] text-base leading-none">⚡</span>
                  <span className="text-[#F2F4F8] text-[12px] font-bold leading-tight">Infinite System complet</span>
                </div>

                <div className="h-px bg-white/5 w-full mb-3"></div>

                <ul className="space-y-2 mb-4 flex-1 min-h-0">
                  {[
                    'White label + branding complet',
                    'Infrastructure dédiée + SLA 99.9%',
                    'Modules sur mesure illimités',
                    'API + SSO + LDAP + Audit logs'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-3.5 h-3.5 rounded border border-[#FFB332]/40 bg-[#FFB332]/10 flex items-center justify-center mt-0.5 shrink-0">
                        <Check size={9} className="text-[#FFB332]" strokeWidth={4} />
                      </div>
                      <span className="text-[11px] md:text-[12px] text-[#8D98AA] font-medium leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/contact" className="w-full text-center px-3 py-2.5 bg-[#5B89C3] hover:bg-[#4A78B2] text-white font-black text-xs rounded-lg transition-all shadow-[0_6px_20px_rgba(91,137,195,0.22)] mb-1 group/btn">
                  Demander une démo <span className="inline-block transition-transform group-hover/btn:translate-x-1">&rarr;</span>
                </Link>
                <p className="text-[9px] text-[#8D98AA]/60 text-center italic leading-tight">Tarification sur devis</p>
              </div>
            </motion.div>

          </motion.div>

          {/* Badges paiement / contact — sous les 3 cartes, compact et centrés */}
          <div className="mt-5 md:mt-6 flex justify-center overflow-x-auto pb-1 [scrollbar-width:thin]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 w-full min-w-0 max-w-[22rem] sm:max-w-2xl md:max-w-4xl mx-auto">
              {[
                { icon: "🔒", t: "Aucun paiement en ligne" },
                { icon: "📱", t: "Wave & Orange Money" },
                { icon: "💬", t: "Contact WhatsApp 24h" },
                { icon: "💳", t: "Aucune carte bancaire" }
              ].map((badge, b) => (
                <div
                  key={b}
                  className="bg-[#0D1320] border border-white/5 rounded-lg px-1.5 py-1.5 md:px-2 md:py-2 flex items-center justify-center gap-1 min-w-0 hover:border-white/10 hover:bg-white/[0.03] transition-colors"
                >
                  <span className="text-xs md:text-sm shrink-0 leading-none" aria-hidden>{badge.icon}</span>
                  <span className="text-[7px] md:text-[8px] font-bold text-[#8D98AA] leading-none uppercase tracking-wide whitespace-nowrap">{badge.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative z-10 border-t border-white/5 bg-[#06080D] py-16 md:py-24">
        <div className="container mx-auto max-w-[1000px] px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="home-cta-panel"
          >
            <HomeSectionLabel accent="neutral" centered className="!text-text-secondary">
              Prêt à commencer ?
            </HomeSectionLabel>
            <h2 className="home-section-title mx-auto mb-6 max-w-3xl">
              Rejoignez les 97 entreprises qui pilotent leur croissance.
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
              Gratuit. Aucune carte bancaire. Notre équipe vous accompagne à chaque étape — de l&apos;inscription au déploiement final.
            </p>
            <Link to="/signup" className="home-btn-primary group">
              Créer mon compte gratuitement
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-text-secondary">
              {['Gratuit', 'Sans carte bancaire', 'Prêt en 2 minutes', 'Support WhatsApp inclus'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-noya-orange" aria-hidden />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      </div>
    </>
  );
}
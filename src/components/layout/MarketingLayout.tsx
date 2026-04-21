import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, Linkedin, Twitter, Instagram, Facebook, Youtube } from 'lucide-react';
import { useState, useEffect, type CSSProperties } from 'react';
import { auth } from '@/lib/clientSdk';
import Logo from '../Logo';
import { useAuth } from '../AuthProvider';
import MarketingV4Background from './MarketingV4Background';
import { cn } from '../../lib/utils';
import { userInitialLetter } from '../../lib/userProfile';
import { getWorkspaceNavLinks } from '../../lib/workspaceSpaces';

/** Liens modules marketing (menu Solutions + footer). */
const MARKETING_SOLUTION_MODULE_LINKS: { to: string; label: string }[] = [
  { to: '/infinite-crm', label: 'Infinite CRM' },
  { to: '/infinite-finance', label: 'Infinite Finance' },
  { to: '/rh', label: 'Infinite RH' },
  { to: '/projects', label: 'Infinite Projects' },
  { to: '/academy', label: 'Infinite Academy' },
  { to: '/comms', label: 'Infinite Comms' },
  { to: '/store', label: 'Infinite Store' },
];

/** Réseaux sociaux affichés dans le pied de page. Remplacer `href` par les URLs officielles. */
const FOOTER_SOCIAL_LINKS: {
  label: string;
  href: string;
  Icon: typeof Linkedin;
  /** Couleur de marque utilisée au survol/focus (teinte officielle du réseau). */
  brandColor: string;
  /** Variante fond à opacité faible (`rgba()`) pour la pastille au survol. */
  brandBg: string;
}[] = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/infinite-core',
    Icon: Linkedin,
    brandColor: '#0A66C2',
    brandBg: 'rgba(10,102,194,0.14)',
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/infinitecore',
    Icon: Twitter,
    brandColor: '#F5F7FF',
    brandBg: 'rgba(245,247,255,0.1)',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/infinitecoresysteme/?utm_source=ig_web_button_share_sheet',
    Icon: Instagram,
    brandColor: '#E4405F',
    brandBg: 'rgba(228,64,95,0.14)',
  },
  {
    label: 'Facebook',
    href: 'https://web.facebook.com/infinitecoresysteme',
    Icon: Facebook,
    brandColor: '#1877F2',
    brandBg: 'rgba(24,119,242,0.14)',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@infinitecore',
    Icon: Youtube,
    brandColor: '#FF0000',
    brandBg: 'rgba(255,0,0,0.14)',
  },
];

const navLinkClass =
  'rounded-md px-3.5 py-2 text-[14px] font-medium text-[#8E9EAE] transition-colors duration-150 hover:bg-white/[0.045] hover:text-[#F5F7FF]';
const dropdownItemClass =
  'block px-4 py-3 text-[13px] leading-snug text-[#C8D0E0] transition-colors hover:bg-white/[0.06] hover:text-[#F5F7FF]';

export default function MarketingLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [solutionsSubOpen, setSolutionsSubOpen] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const { user, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = userData?.role;
  const workspaceLinks = user ? getWorkspaceNavLinks(role) : [];
  const hideGuestAuthLinks = location.pathname.startsWith('/login');
  const handleLogout = async () => {
    localStorage.removeItem('demoRole');
    await auth.signOut();
    navigate('/login');
  };

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) setSolutionsSubOpen(false);
  }, [isMenuOpen]);

  return (
    <div className="flex min-h-dvh flex-col bg-black font-[Urbanist,ui-sans-serif,system-ui,sans-serif] text-[#C8D0E0] selection:bg-noya-blue/30">
      <MarketingV4Background />

      {/* HEADER — nav fixe floutée (infinitecore-v4.html) */}
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-[900] overflow-visible border-b border-white/[0.07] bg-black text-[#F5F7FF] transition-[box-shadow,colors] duration-300',
          navSolid && 'shadow-[0_10px_28px_-12px_rgba(0,0,0,0.75)]',
        )}
      >
        <div className="container mx-auto flex h-[84px] min-w-0 items-center justify-between gap-2 overflow-visible px-3 sm:px-6 lg:px-[52px]">
          {/* À partir de `md`, le menu est centré en absolu : on borne la zone logo pour éviter l’empiètement visuel */}
          <div className="relative z-[904] flex min-h-0 min-w-0 flex-1 items-center justify-start overflow-visible md:max-w-[min(318px,48vw)] lg:max-w-[min(368px,42vw)]">
            <Link
              to="/"
              className="group/logo flex h-full min-w-0 shrink items-center overflow-visible self-stretch outline-none focus-visible:ring-2 focus-visible:ring-[#6EA7EA]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-sm"
            >
              {/* Barre 84px : plus de place réservée au logo sur md+ (max-w) + scale un peu plus haut sans empiéter sur le menu */}
              <span className="inline-flex origin-left scale-[1.56] will-change-transform sm:scale-[1.64] md:scale-[1.42] lg:scale-[1.48]">
                <Logo matchMarketingNav className="h-[3.15rem] w-auto shrink-0 sm:h-[3.45rem] md:h-[3.3rem] lg:h-[3.45rem]" />
              </span>
            </Link>
          </div>
          
          <nav className="absolute left-1/2 z-[905] hidden -translate-x-1/2 items-center gap-1 md:flex" aria-label="Navigation principale">
            <div className="relative group">
              <button
                type="button"
                className={cn(
                  navLinkClass,
                  'flex items-center gap-1 border-0 bg-transparent cursor-pointer',
                )}
                aria-haspopup="true"
              >
                Solutions
                <ChevronDown size={14} className="text-[#8E9EAE] opacity-80 transition-transform duration-200 group-hover:rotate-180" aria-hidden />
              </button>
              <div
                aria-label="Solutions Infinite Core"
                className="invisible absolute left-1/2 top-full z-[910] mt-2 w-[min(100vw-2rem,17rem)] -translate-x-1/2 translate-y-1 overflow-hidden rounded-lg border border-white/[0.08] bg-black text-left opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
              >
                <Link to="/solutions" className={cn(dropdownItemClass, 'font-medium text-[#F5F7FF]')}>
                  Toutes les solutions
                </Link>
                <div className="border-t border-white/[0.07]" aria-hidden />
                {MARKETING_SOLUTION_MODULE_LINKS.map((item) => (
                  <Link key={item.to} to={item.to} className={dropdownItemClass}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            {[
              { to: '/a-propos', label: 'À propos' },
              { to: '/tarifs', label: 'Tarifs' },
              { to: '/faq', label: 'FAQ' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex flex-1 justify-end items-center gap-2.5">
            {user ? (
              <div className="relative group">
                <button className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[13px] text-[#F5F7FF] transition-colors hover:bg-white/[0.07]">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4A7FB5] text-[10px] font-bold text-white">
                    {userInitialLetter(userData, "U", user.email)}
                  </div>
                  <span className="hidden lg:inline">Mon espace</span>
                  <ChevronDown size={13} className="text-[#8E9EAE]" />
                </button>
                <div className="invisible absolute right-0 top-full z-[910] mt-2 min-w-[14rem] max-w-[18rem] translate-y-1 overflow-hidden rounded-lg border border-white/[0.08] bg-black text-[#C8D0E0] opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  {workspaceLinks.map((space) => (
                    <Link key={space.id} to={space.to} className="block px-4 py-3 text-[13px] transition-colors hover:bg-white/[0.06] hover:text-[#F5F7FF]">
                      {space.label}
                    </Link>
                  ))}
                  {role === 'client' && (
                    <>
                      <Link to="/dashboard/profil" className="block px-4 py-3 text-[13px] transition-colors hover:bg-white/[0.06] hover:text-[#F5F7FF]">Mon profil</Link>
                      <Link to="/dashboard/boutique" className="block px-4 py-3 text-[13px] transition-colors hover:bg-white/[0.06] hover:text-[#F5F7FF]">Boutique & Services</Link>
                    </>
                  )}
                  <div className="border-t border-white/[0.07]" />
                  <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-[13px] text-noya-red transition-colors hover:bg-noya-red/10">
                    Déconnexion
                  </button>
                </div>
              </div>
            ) : hideGuestAuthLinks ? null : (
              <>
                <Link
                  to="/login"
                  className="rounded-md border border-white/[0.07] px-4 py-2.5 text-sm font-medium text-[#8E9EAE] transition-all duration-200 hover:border-white/[0.12] hover:text-[#F5F7FF]"
                >
                  Connexion
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-linear-to-br from-[#E8961E] to-[#F5A623] px-[18px] py-2.5 text-sm font-bold text-[#0D0700] shadow-[0_0_0_1px_rgba(232,150,30,0.25),0_2px_14px_rgba(232,150,30,0.22)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(232,150,30,0.35),0_4px_18px_rgba(232,150,30,0.26)]"
                >
                  Créer mon compte
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="p-1.5 text-[#8E9EAE] transition-colors hover:text-[#F5F7FF] md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Nav - Slide Down */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${
            isMenuOpen ? 'max-h-[80vh] opacity-100' : 'pointer-events-none max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-3 border-t border-white/[0.07] bg-black px-4 py-4">
            {/* Nav Links */}
            <nav className="space-y-1" aria-label="Navigation principale">
              <div>
                <button
                  type="button"
                  id="nav-mobile-solutions"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-[13px] font-medium text-[#8E9EAE] transition-all hover:bg-white/[0.06] hover:text-[#F5F7FF]"
                  aria-expanded={solutionsSubOpen ? 'true' : 'false'}
                  aria-controls="nav-mobile-solutions-panel"
                  onClick={() => setSolutionsSubOpen((o) => !o)}
                >
                  Solutions
                  <ChevronDown
                    size={14}
                    className={cn('shrink-0 text-[#8E9EAE] transition-transform duration-200', solutionsSubOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                <div
                  id="nav-mobile-solutions-panel"
                  role="region"
                  aria-labelledby="nav-mobile-solutions"
                  hidden={!solutionsSubOpen}
                  className="mt-0.5 space-y-0 border-l border-white/[0.08] pl-2.5 ml-1.5"
                >
                  <Link
                    to="/solutions"
                    className="block rounded-md py-2 pr-2 text-xs font-medium text-[#F5F7FF] transition-colors hover:text-white"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Toutes les solutions
                  </Link>
                  {MARKETING_SOLUTION_MODULE_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="block rounded-md py-2 pr-2 text-xs text-[#8E9EAE] transition-colors hover:text-[#F5F7FF]"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
              {[
                { to: '/a-propos', label: 'À propos' },
                { to: '/tarifs', label: 'Tarifs' },
                { to: '/faq', label: 'FAQ' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block rounded-md px-3 py-2.5 text-[13px] font-medium text-[#8E9EAE] transition-all hover:bg-white/[0.06] hover:text-[#F5F7FF]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Auth Section */}
            <div className="border-t border-white/[0.07] pt-3">
              {user ? (
                <div className="space-y-0">
                  <p className="mb-1.5 px-3 text-[11px] font-black uppercase tracking-widest text-[#5E6E84]">Mon compte</p>
                  {workspaceLinks.map((space) => (
                    <Link
                      key={space.id}
                      to={space.to}
                      className="block rounded-md px-3 py-2.5 text-[13px] text-[#8E9EAE] transition-all hover:bg-white/[0.06] hover:text-[#F5F7FF]"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {space.label}
                    </Link>
                  ))}
                  {role === 'client' && (
                    <>
                      <Link to="/dashboard/profil" className="block rounded-md px-3 py-2.5 text-[13px] text-[#8E9EAE] transition-all hover:bg-white/[0.06] hover:text-[#F5F7FF]" onClick={() => setIsMenuOpen(false)}>Mon profil</Link>
                      <Link to="/dashboard/boutique" className="block rounded-md px-3 py-2.5 text-[13px] text-[#8E9EAE] transition-all hover:bg-white/[0.06] hover:text-[#F5F7FF]" onClick={() => setIsMenuOpen(false)}>Boutique & Services</Link>
                    </>
                  )}
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="mt-0.5 w-full rounded-md px-3 py-2.5 text-left text-[13px] font-medium text-noya-red transition-all hover:bg-noya-red/10"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : hideGuestAuthLinks ? null : (
                <div className="flex flex-col gap-2.5">
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-md border border-white/[0.07] py-2.5 text-center text-[13px] font-medium text-[#8E9EAE] transition-all hover:border-white/[0.12] hover:text-[#F5F7FF]"
                  >
                    Connexion
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-md bg-linear-to-br from-[#E8961E] to-[#F5A623] py-2.5 text-center text-[13px] font-bold text-[#0D0700] shadow-[0_0_0_1px_rgba(232,150,30,0.25),0_2px_14px_rgba(232,150,30,0.22)] transition-all"
                  >
                    Créer mon compte
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN — le contenu passe sous la nav fixe (padding géré par les pages, ex. Home) */}
      <main className="relative z-10 flex-1 pt-[84px]">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 mt-auto border-t border-white/[0.07] bg-black text-[#5E6E84]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#E8961E]/30 to-transparent"
          aria-hidden
        />
        <div className="container mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-10 xl:px-10">
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 lg:mb-7 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-0 xl:gap-x-8">
            {/* Marque */}
            <div className="col-span-3 sm:col-span-2 lg:col-span-5 xl:col-span-4">
              <Link to="/" className="group/logo inline-block transition-opacity hover:opacity-90">
                <Logo matchMarketingNav className="h-10 sm:h-11 md:h-12" />
              </Link>
              <p className="mt-2 max-w-[280px] text-[11px] font-normal leading-snug text-[#6B7A90] sm:text-[12px] sm:leading-relaxed">
                The Operating System for African Business. Suite SaaS modulaire pour PME et grandes entreprises
                d&apos;Afrique — conçue par Noya Industries, Abidjan.
              </p>
              <ul className="mt-3 flex items-center gap-2 sm:mt-4 sm:gap-2.5" aria-label="Réseaux sociaux">
                {FOOTER_SOCIAL_LINKS.map(({ label, href, Icon, brandColor, brandBg }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      style={
                        {
                          '--brand-color': brandColor,
                          '--brand-bg': brandBg,
                        } as CSSProperties
                      }
                      className="group inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--brand-color)]/35 bg-[color:var(--brand-bg)] text-[color:var(--brand-color)] transition-all duration-150 hover:scale-105 hover:border-[color:var(--brand-color)]/70 hover:bg-[color:var(--brand-bg)] hover:shadow-[0_0_14px_-2px_var(--brand-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-color)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-9 sm:w-9"
                    >
                      <Icon size={14} strokeWidth={1.9} aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <nav className="col-span-1 text-center lg:col-span-2 lg:text-left" aria-label="Solutions">
              <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8E9EAE]">
                Solutions
              </h4>
              <ul className="flex flex-col items-center gap-1 lg:items-start">
                <li>
                  <Link
                    to="/solutions"
                    className="inline-block py-0.5 text-[11px] text-[#6B7A90] transition-colors duration-150 hover:text-[#F5F7FF] sm:text-xs"
                  >
                    Toutes les solutions
                  </Link>
                </li>
                {MARKETING_SOLUTION_MODULE_LINKS.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="inline-block py-0.5 text-[11px] text-[#5E6E84] transition-colors duration-150 hover:text-[#F5F7FF] sm:text-xs"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav className="col-span-1 text-center lg:col-span-2 lg:text-left" aria-label="Entreprise">
              <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8E9EAE]">
                Entreprise
              </h4>
              <ul className="flex flex-col items-center gap-1 lg:items-start">
                {[
                  { to: '/#system', label: 'Infinite System' },
                  { to: '/a-propos', label: 'À propos' },
                  { to: '/tarifs', label: 'Tarifs' },
                  { to: '/faq', label: 'FAQ' },
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="inline-block py-0.5 text-[11px] text-[#5E6E84] transition-colors duration-150 hover:text-[#F5F7FF] sm:text-xs"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav className="col-span-1 text-center sm:col-span-2 lg:col-span-3 lg:text-left xl:col-span-4" aria-label="Légal">
              <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8E9EAE]">
                Légal
              </h4>
              <ul className="flex flex-col items-center gap-1.5 lg:items-start lg:gap-1">
                {[
                  { to: '/mentions-legales', label: 'Mentions légales' },
                  { to: '/confidentialite', label: 'Confidentialité' },
                  { to: '/cgu', label: 'CGU' },
                  { to: '/cgv', label: 'CGV' },
                  { to: '/cookies', label: 'Cookies' },
                  { to: '/securite', label: 'Sécurité' },
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="inline-block py-0.5 text-[11px] text-[#5E6E84] transition-colors duration-150 hover:text-[#F5F7FF] sm:text-xs"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="border-t border-white/[0.07] pt-4 sm:pt-5">
            <div className="flex justify-center pb-1">
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] leading-snug text-[#5E6E84] sm:gap-x-2.5 sm:text-[11px]">
              <span className="text-center">
                © {new Date().getFullYear()}{' '}
                <span className="text-[#8E9EAE]">Infinite Core</span>
                {' · '}
                <span>Noya Industries</span>
                <span className="text-[#5E6E84]/80"> · Abidjan, Côte d&apos;Ivoire</span>
              </span>
              <span className="text-[#5E6E84]/35" aria-hidden>
                ·
              </span>
              <Link
                to="/mentions-legales"
                className="whitespace-nowrap transition-colors duration-150 hover:text-[#F5F7FF]"
              >
                Mentions légales
              </Link>
              <span className="text-[#5E6E84]/35" aria-hidden>
                ·
              </span>
              <Link
                to="/confidentialite"
                className="whitespace-nowrap transition-colors duration-150 hover:text-[#F5F7FF]"
              >
                Confidentialité
              </Link>
              <span className="text-[#5E6E84]/35" aria-hidden>
                ·
              </span>
              <Link
                to="/cookies"
                className="whitespace-nowrap transition-colors duration-150 hover:text-[#F5F7FF]"
              >
                Cookies
              </Link>
              <span className="text-[#5E6E84]/35" aria-hidden>
                ·
              </span>
              <Link
                to="/login/staff"
                className="whitespace-nowrap transition-colors duration-150 hover:text-[#F5F7FF]"
              >
                Espace Staff
              </Link>
              <span className="text-[#5E6E84]/35" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('ic_consent');
                  window.location.reload();
                }}
                className="whitespace-nowrap text-left transition-colors duration-150 hover:text-[#F5F7FF]"
              >
                Préférences cookies
              </button>
              </div>
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-[10px] italic leading-snug text-[#6B7A90] sm:text-[11px]">
              <span className="h-px w-4 shrink-0 bg-current opacity-25" aria-hidden />
              <span className="max-w-md text-balance">The Operating System for African Business</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

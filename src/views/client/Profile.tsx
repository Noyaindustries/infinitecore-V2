import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  LayoutDashboard,
  Loader2,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../../components/FirebaseProvider';
import { auth, db } from '../../firebase';

const INDUSTRIES = [
  { value: '', label: 'Non renseigné' },
  { value: 'BTP', label: 'BTP' },
  { value: 'Commerce', label: 'Commerce' },
  { value: 'Services', label: 'Services' },
  { value: 'Consulting', label: 'Consulting' },
  { value: 'ONG', label: 'ONG' },
  { value: 'Autre', label: 'Autre' },
  { value: 'Non spécifié', label: 'Non spécifié' },
] as const;

const EMPLOYEE_RANGES = [
  { value: '', label: 'Non renseigné' },
  { value: '1-5', label: '1 à 5' },
  { value: '6-20', label: '6 à 20' },
  { value: '21-50', label: '21 à 50' },
  { value: '50+', label: '50 et +' },
] as const;

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  industry: string;
  employees: string;
};

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  phone: '',
  company: '',
  industry: '',
  employees: '',
};

function userDataToForm(data: Record<string, unknown> | null): FormState {
  if (!data) return { ...emptyForm };
  return {
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    company: typeof data.company === 'string' ? data.company : '',
    industry: typeof data.industry === 'string' ? data.industry : '',
    employees: typeof data.employees === 'string' ? data.employees : '',
  };
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#060910]/90 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-colors focus:border-luxe-champagne/40 focus:outline-none focus:ring-2 focus:ring-luxe-champagne/15';

const labelClass = 'mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-luxe-champagne/85';

export default function ClientProfile() {
  const { user, userData, isAuthReady } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);

  useEffect(() => {
    setForm(userDataToForm(userData as Record<string, unknown> | null));
  }, [userData]);

  const displayName = useMemo(() => {
    const full = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    return user?.displayName || user?.email?.split('@')[0] || 'Client';
  }, [form.firstName, form.lastName, user]);

  const email = user?.email ?? '';
  const roleLabel = useMemo(() => {
    const r = userData && typeof (userData as { role?: string }).role === 'string' ? (userData as { role: string }).role : 'client';
    if (r === 'client') return 'Client';
    return r;
  }, [userData]);

  const memberSince = useMemo(() => {
    const c = userData && typeof (userData as { createdAt?: string }).createdAt === 'string' ? (userData as { createdAt: string }).createdAt : null;
    if (!c) return null;
    try {
      return new Date(c).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return null;
    }
  }, [userData]);

  const packLabel = useMemo(() => {
    const p = userData && typeof (userData as { pack?: string }).pack === 'string' ? (userData as { pack: string }).pack : '';
    return p || 'Starter';
  }, [userData]);

  const industryOptions = useMemo(() => {
    const known = new Set<string>(INDUSTRIES.map((x) => x.value as string));
    if (form.industry && !known.has(form.industry)) {
      return [...INDUSTRIES, { value: form.industry, label: form.industry } as const];
    }
    return [...INDUSTRIES];
  }, [form.industry]);

  const employeeOptions = useMemo(() => {
    const known = new Set<string>(EMPLOYEE_RANGES.map((x) => x.value as string));
    if (form.employees && !known.has(form.employees)) {
      return [...EMPLOYEE_RANGES, { value: form.employees, label: form.employees } as const];
    }
    return [...EMPLOYEE_RANGES];
  }, [form.employees]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast.error('Vous devez être connecté.');
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Le prénom et le nom sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        industry: form.industry,
        employees: form.employees,
      });
      const dn = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
      if (dn && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: dn });
      }
      toast.success('Profil enregistré.');
    } catch (err) {
      console.error('[ClientProfile] save:', err);
      toast.error('Impossible d’enregistrer le profil. Réessayez plus tard.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast.error('Aucune adresse e-mail associée au compte.');
      return;
    }
    setResettingPwd(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('E-mail de réinitialisation envoyé. Vérifiez votre boîte.');
    } catch (err) {
      console.error('[ClientProfile] reset email:', err);
      toast.error('Envoi impossible pour le moment.');
    } finally {
      setResettingPwd(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-12">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-white/10" />
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-linear-to-br from-[#0c101c] via-[#080c14] to-[#05080f] p-6 shadow-[0_32px_64px_-28px_rgba(0,0,0,0.75),0_0_0_1px_rgba(201,169,98,0.1),inset_0_1px_0_0_rgba(255,255,255,0.05)] sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/30 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-noya-blue/12 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-luxe-champagne/30 bg-linear-to-br from-luxe-champagne/20 to-noya-blue/10 text-luxe-champagne-bright shadow-[0_0_24px_-8px_rgba(201,169,98,0.35)]">
              <User className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-luxe-champagne/25 bg-luxe-champagne/[0.07] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-luxe-champagne-bright">
                Mon profil
              </div>
              <h1 className="font-display text-2xl font-medium tracking-[0.02em] text-text-primary sm:text-3xl">{displayName}</h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-secondary">
                Informations utilisées pour votre dossier, vos commandes et vos échanges avec Infinite Core. Vous pouvez les
                mettre à jour à tout moment.
              </p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-luxe-champagne/30 hover:text-text-primary"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Mon espace
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identité */}
        <section className="rounded-2xl border border-white/[0.07] bg-[#0a0e18]/85 p-5 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-luxe-champagne/85">Identité</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-firstName" className={labelClass}>
                Prénom
              </label>
              <input
                id="profile-firstName"
                type="text"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                className={inputClass}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label htmlFor="profile-lastName" className={labelClass}>
                Nom
              </label>
              <input
                id="profile-lastName"
                type="text"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                className={inputClass}
                placeholder="Nom"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="profile-phone" className={labelClass}>
                Téléphone
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="+225 …"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Organisation */}
        <section className="rounded-2xl border border-white/[0.07] bg-[#0a0e18]/85 p-5 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-luxe-champagne/85">Organisation</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="profile-company" className={labelClass}>
                Entreprise
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <input
                  id="profile-company"
                  type="text"
                  autoComplete="organization"
                  value={form.company}
                  onChange={(e) => updateField('company', e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="Raison sociale"
                />
              </div>
            </div>
            <div>
              <label htmlFor="profile-industry" className={labelClass}>
                Secteur
              </label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <select
                  id="profile-industry"
                  value={form.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  className={`${inputClass} appearance-none pl-10 pr-10`}
                >
                  {industryOptions.map((o) => (
                    <option key={`ind-${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="profile-employees" className={labelClass}>
                Effectifs
              </label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <select
                  id="profile-employees"
                  value={form.employees}
                  onChange={(e) => updateField('employees', e.target.value)}
                  className={`${inputClass} appearance-none pl-10 pr-10`}
                >
                  {employeeOptions.map((o) => (
                    <option key={`emp-${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Compte (lecture + sécurité) */}
        <section className="rounded-2xl border border-white/[0.07] bg-[#0a0e18]/85 p-5 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-luxe-champagne/85">Compte</h2>
          <p className="mt-2 text-xs text-text-muted">
            L’adresse e-mail de connexion est gérée par l’authentification sécurisée ; pour la modifier, contactez le support
            Infinite.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <span className={labelClass}>E-mail</span>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#060910]/60 px-4 py-3 text-sm text-text-secondary">
                <Mail className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0 truncate">{email || '—'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full border border-noya-blue/25 bg-noya-blue/10 px-3 py-1 text-xs font-semibold text-noya-blue">
                {roleLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-text-secondary">
                Formule : <span className="ml-1 font-medium capitalize text-text-primary">{packLabel}</span>
              </span>
              {memberSince ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-text-secondary">
                  Membre depuis <span className="ml-1 font-medium text-text-primary">{memberSince}</span>
                </span>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-noya-blue/10 text-noya-blue">
                    <Shield className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Mot de passe</p>
                    <p className="mt-0.5 text-xs text-text-muted">Recevez un lien sécurisé par e-mail pour en définir un nouveau.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePasswordReset()}
                  disabled={resettingPwd || !email}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-noya-blue/30 bg-noya-blue/10 px-4 py-2.5 text-sm font-semibold text-noya-blue transition-colors hover:bg-noya-blue/20 disabled:opacity-50"
                >
                  {resettingPwd ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Réinitialiser par e-mail
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-luxe-champagne to-[#dfc78a] px-6 py-3 text-sm font-bold text-[#1a1508] shadow-[0_8px_28px_-6px_rgba(201,169,98,0.45)] transition-all hover:brightness-105 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Enregistrer les modifications
          </button>
          <Link
            to="/dashboard/messagerie"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-noya-blue transition-all hover:gap-2 hover:text-luxe-champagne-bright"
          >
            Contacter l’équipe
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </form>
    </div>
  );
}

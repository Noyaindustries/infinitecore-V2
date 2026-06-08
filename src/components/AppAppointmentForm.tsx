import { useState } from 'react';
import { Calendar, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiRequest } from '@/lib/apiClient';
import { trackSeaEvent } from './SeaTracking';

type Props = {
  appId: string;
  appTitle: string;
};

export default function AppAppointmentForm({ appId, appTitle }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error('Prénom, nom et WhatsApp sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest<{ success: boolean; error?: string }>('/api/apps/appointment', {
        method: 'POST',
        body: JSON.stringify({
          appId,
          appTitle,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          companyName: companyName.trim(),
          preferredDate: preferredDate.trim(),
          message: message.trim(),
        }),
      });
      trackSeaEvent('generate_lead', {
        lead_type: 'app_appointment',
        app_id: appId,
        app_name: appTitle,
      });
      setSent(true);
      toast.success('Demande envoyée — nous vous contactons sous 24h.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Envoi impossible. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#2BC673]/30 bg-[#2BC673]/10 p-6 text-center">
        <p className="text-lg font-bold text-[#F2F4F8]">Merci, votre demande est enregistrée.</p>
        <p className="mt-2 text-sm text-[#8D98AA]">
          L&apos;équipe Infinite Core vous recontacte par WhatsApp ou e-mail pour planifier votre démo de{' '}
          <strong className="text-[#F2F4F8]">{appTitle}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`rdv-fn-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
            Prénom *
          </label>
          <input
            id={`rdv-fn-${appId}`}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
            required
          />
        </div>
        <div>
          <label htmlFor={`rdv-ln-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
            Nom *
          </label>
          <input
            id={`rdv-ln-${appId}`}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`rdv-email-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
            E-mail
          </label>
          <input
            id={`rdv-email-${appId}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
          />
        </div>
        <div>
          <label htmlFor={`rdv-phone-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
            WhatsApp / Téléphone *
          </label>
          <input
            id={`rdv-phone-${appId}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 07 00 00 00 00"
            className="w-full rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`rdv-co-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
            Entreprise
          </label>
          <input
            id={`rdv-co-${appId}`}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
          />
        </div>
        <div>
          <label htmlFor={`rdv-date-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
            Date souhaitée
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D98AA]" />
            <input
              id={`rdv-date-${appId}`}
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1320] py-2.5 pl-10 pr-3 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
            />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor={`rdv-msg-${appId}`} className="mb-1 block text-xs font-semibold uppercase text-[#8D98AA]">
          Votre besoin
        </label>
        <textarea
          id={`rdv-msg-${appId}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Décrivez votre contexte, nombre d'utilisateurs, délai souhaité…"
          className="w-full rounded-xl border border-white/10 bg-[#0D1320] px-3 py-2.5 text-sm text-[#F2F4F8] outline-none focus:border-[#FFB332]/50"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFB332] px-5 py-3 text-sm font-bold text-[#06080D] transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
      >
        <Send className="h-4 w-4" />
        {submitting ? 'Envoi…' : 'Demander un rendez-vous'}
      </button>
    </form>
  );
}

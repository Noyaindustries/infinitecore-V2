import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export interface CommandoClientRow {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  role?: string;
  phone?: string;
  companyName?: string;
  referredBy?: string | null;
  referredByPartnerId?: string | null;
  referredByPartnerName?: string | null;
}

export function clientDisplayName(c: CommandoClientRow): string {
  const n = `${c.firstName || ''} ${c.lastName || ''}`.trim();
  return n || c.email || 'Client';
}

/**
 * Liste des comptes portail « client » (même logique que Dossiers admin : filtre rôle insensible à la casse).
 */
export function useCommandoClients() {
  const [clients, setClients] = useState<CommandoClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommandoClientRow));

        // Fallback: reconstitue le nom du parrain via l'UID si le champ nommé n'existe pas encore.
        const partnerNameById = new Map<string, string>();
        for (const row of rows) {
          const role = String(row.role || '').toLowerCase();
          if (role !== 'partner') continue;
          const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
          const fallbackLabel = fullName || row.email || `Partenaire ${row.id}`;
          partnerNameById.set(row.id, fallbackLabel);
        }

        const data = rows
          .filter((u) => String(u.role || '').toLowerCase() === 'client')
          .map((u) => {
            const fallbackName = u.referredByPartnerId ? partnerNameById.get(u.referredByPartnerId) : null;
            return {
              ...u,
              referredByPartnerName: u.referredByPartnerName || fallbackName || null,
            } as CommandoClientRow;
          })
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setClients(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useCommandoClients]', err);
        toast.error('Impossible de charger les clients.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { clients, loading };
}

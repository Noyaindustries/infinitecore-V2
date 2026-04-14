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
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CommandoClientRow))
          .filter((u) => String(u.role || '').toLowerCase() === 'client')
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

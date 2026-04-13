import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

export type LeadStatus =
  | 'soumis'
  | 'contacte'
  | 'en_demo'
  | 'proposition'
  | 'signe'
  | 'gagne'
  | 'perdu';

export interface Lead {
  id: string;
  partnerId: string;
  partnerName: string;
  firstName?: string;
  lastName?: string;
  companyName: string;
  sector?: string;
  whatsapp: string;
  status: LeadStatus;
  commissionAmount?: number;
  commissionPaid?: boolean;
  commandoNote?: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
}

const COL = 'leads';

export const leadService = {
  async createLead(data: Omit<Lead, 'id' | 'createdAt'>) {
    const docRef = await addDoc(collection(db, COL), {
      ...data,
      status: 'soumis',
      createdAt: new Date().toISOString(),
    });
    await updateDoc(docRef, { id: docRef.id });
    return docRef.id;
  },

  async updateLead(leadId: string, updates: Partial<Lead>) {
    await updateDoc(doc(db, COL, leadId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteLead(leadId: string) {
    await deleteDoc(doc(db, COL, leadId));
  },

  subscribeToPartnerLeads(partnerId: string, callback: (leads: Lead[]) => void) {
    const q = query(
      collection(db, COL),
      where('partnerId', '==', partnerId)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
    }, (error) => {
      console.error("Error in subscribeToPartnerLeads:", error);
    });
  },

  subscribeToAllLeads(callback: (leads: Lead[]) => void) {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
    });
  },
};

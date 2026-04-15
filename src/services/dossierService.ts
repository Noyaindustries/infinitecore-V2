import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';

export type StepType = 'audit' | 'proposition' | 'contrat' | 'facture';

export type StepStatus = 'en_attente' | 'soumis' | 'valide';

export interface DossierStep {
  id: string;
  clientId: string;
  stepType: StepType;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string;
  status: StepStatus;
  validatedAt?: string;
  note?: string;
}

export const STEP_META: Record<StepType, { label: string; description: string; color: string; order: number }> = {
  audit: {
    label: 'Audit',
    description: 'Rapport d\'audit technique et commercial',
    color: 'blue',
    order: 0,
  },
  proposition: {
    label: 'Proposition',
    description: 'Proposition commerciale détaillée',
    color: 'orange',
    order: 1,
  },
  contrat: {
    label: 'Contrat',
    description: 'Contrat de prestation à valider',
    color: 'purple',
    order: 2,
  },
  facture: {
    label: 'Facture',
    description: 'Facture définitive de la prestation',
    color: 'green',
    order: 3,
  },
};

export const STEP_ORDER: StepType[] = ['audit', 'proposition', 'contrat', 'facture'];

const COL = 'dossier_steps';

export const dossierService = {
  // Commando uploads a doc for a client step (single write = one create rule evaluation)
  async createStep(data: Omit<DossierStep, 'id' | 'uploadedAt' | 'status'>) {
    const docRef = doc(collection(db, COL));
    await setDoc(docRef, {
      id: docRef.id,
      ...data,
      status: 'soumis',
      uploadedAt: new Date().toISOString(),
    });
    return docRef.id;
  },

  // Client validates a step
  async validateStep(stepId: string, clientId: string) {
    await updateDoc(doc(db, COL, stepId), {
      status: 'valide',
      validatedAt: new Date().toISOString(),
      clientId,
    });
  },

  // Commando deletes / replaces a step doc
  async deleteStep(stepId: string) {
    await deleteDoc(doc(db, COL, stepId));
  },

  // Subscribe: client's dossier steps
  subscribeToClientSteps(clientId: string, callback: (steps: DossierStep[]) => void) {
    const q = query(
      collection(db, COL),
      where('clientId', '==', clientId)
    );
    return onSnapshot(q, (snap) => {
      const steps = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DossierStep))
        .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
      callback(steps);
    }, (error) => {
      console.error('[dossierService] subscribeToClientSteps error:', error);
      callback([]);
    });
  },

  // Subscribe: all clients' steps (admin / commando). No orderBy → évite un index composite ; tri côté client.
  subscribeToAllSteps(callback: (steps: DossierStep[]) => void) {
    const q = query(collection(db, COL));
    return onSnapshot(
      q,
      (snap) => {
        const steps = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as DossierStep))
          .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
        callback(steps);
      },
      (error) => {
        console.error('[dossierService] subscribeToAllSteps error:', error);
        callback([]);
      }
    );
  },
};

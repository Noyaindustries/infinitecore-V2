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
  Timestamp,
  getDoc
} from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export interface Mission {
  id: string;
  clientId: string;
  clientName?: string;
  assignedTo?: string;
  assignedToName?: string;
  title: string;
  description?: string;
  serviceType?: string;
  serviceName?: string;
  servicePrice?: number;
  devCommission?: number;
  deliveryUrl?: string;
  progressNote?: string;
  validatedAt?: string;
  status: 'en_attente' | 'en_cours' | 'en_revue' | 'termine' | 'annule';
  priority: 'basse' | 'moyenne' | 'haute';
  type?: string;
  deadline?: string;
  createdAt: string;
  updatedAt?: string;
}

const MISSIONS_COLLECTION = 'missions';

export const missionService = {
  // Create a new mission
  async createMission(missionData: Omit<Mission, 'id' | 'createdAt'>) {
    const mission = {
      ...missionData,
      createdAt: new Date().toISOString(),
      status: missionData.status || 'en_attente'
    };

    try {
      const docRef = await addDoc(collection(db, MISSIONS_COLLECTION), mission);
      await updateDoc(docRef, { id: docRef.id });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, MISSIONS_COLLECTION);
    }
  },

  // Update a mission
  async updateMission(missionId: string, updates: Partial<Mission>) {
    const missionRef = doc(db, MISSIONS_COLLECTION, missionId);
    try {
      await updateDoc(missionRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${MISSIONS_COLLECTION}/${missionId}`);
    }
  },

  // Get missions for a client
  subscribeToClientMissions(clientId: string, callback: (missions: Mission[]) => void) {
    const q = query(
      collection(db, MISSIONS_COLLECTION),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
      callback(missions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, MISSIONS_COLLECTION);
    });
  },

  // Get missions for a commando/partner
  subscribeToAssignedMissions(userId: string, callback: (missions: Mission[]) => void) {
    const q = query(
      collection(db, MISSIONS_COLLECTION),
      where('assignedTo', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
      callback(missions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, MISSIONS_COLLECTION);
    });
  },

  // Get all missions (Admin)
  subscribeToAllMissions(callback: (missions: Mission[]) => void) {
    const q = query(
      collection(db, MISSIONS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
      callback(missions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, MISSIONS_COLLECTION);
    });
  }
};

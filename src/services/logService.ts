import { 
  collection, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  limit
} from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export interface Log {
  id: string;
  userId?: string;
  action: string;
  details?: string;
  timestamp: string;
}

const LOGS_COLLECTION = 'logs';

export const logService = {
  // Create a log entry
  async createLog(logData: Omit<Log, 'id' | 'timestamp'>) {
    const log = {
      ...logData,
      timestamp: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, LOGS_COLLECTION), log);
      await updateDoc(docRef, { id: docRef.id });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, LOGS_COLLECTION);
    }
  },

  // Subscribe to all logs (Admin)
  subscribeToLogs(callback: (logs: Log[]) => void, maxLogs: number = 100) {
    const q = query(
      collection(db, LOGS_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(maxLogs)
    );

    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      callback(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, LOGS_COLLECTION);
    });
  }
};

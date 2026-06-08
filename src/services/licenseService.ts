import { collection, onSnapshot, orderBy, query, where } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import type { AppLicense } from '@/lib/licenses';

const LICENSES_COLLECTION = 'licenses';

export const licenseService = {
  subscribeToUserLicenses(userId: string, callback: (licenses: AppLicense[]) => void): () => void {
    const q = query(collection(db, LICENSES_COLLECTION), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      const licenses = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as AppLicense);
      callback(licenses);
    });
  },

  subscribeToAllLicenses(callback: (licenses: AppLicense[]) => void): () => void {
    const q = query(collection(db, LICENSES_COLLECTION), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const licenses = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as AppLicense);
        callback(licenses);
      },
      () => callback([])
    );
  },
};

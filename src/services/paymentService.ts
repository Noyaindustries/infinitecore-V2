import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  stripeId?: string;
  description?: string;
  createdAt: string;
}

const PAYMENTS_COLLECTION = 'payments';

export const paymentService = {
  // Record a payment
  async recordPayment(paymentData: Omit<Payment, 'id' | 'createdAt'>) {
    const payment = {
      ...paymentData,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), payment);
      await updateDoc(docRef, { id: docRef.id });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PAYMENTS_COLLECTION);
    }
  },

  // Mock Stripe payment processing — À REMPLACER par une vraie intégration Stripe avant la mise en production
  async processPayment(userId: string, amount: number, description: string) {
    if ((import.meta as any).env?.PROD) {
      throw new Error('Le traitement des paiements réels n\'est pas encore configuré. Veuillez intégrer Stripe.');
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const idArray = new Uint8Array(9);
    crypto.getRandomValues(idArray);
    const mockStripeId = Array.from(idArray, b => b.toString(16).padStart(2, '0')).join('');

    const paymentData: Omit<Payment, 'id' | 'createdAt'> = {
      userId,
      amount,
      currency: 'XOF',
      status: 'succeeded',
      description,
      stripeId: `pi_mock_${mockStripeId}`
    };

    try {
      const paymentId = await this.recordPayment(paymentData);

      const orderData = {
        userId,
        serviceName: description,
        amount,
        status: 'Nouveau',
        createdAt: new Date().toISOString(),
        paymentId
      };
      await addDoc(collection(db, 'orders'), orderData);

      await addDoc(collection(db, 'notifications'), {
        userId,
        title: 'Paiement réussi',
        message: `Votre paiement de ${amount.toLocaleString('fr-FR')} FCFA pour "${description}" a été validé.`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      return { success: true, paymentId };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PAYMENTS_COLLECTION);
      throw error;
    }
  },

  // Subscribe to user payments
  subscribeToUserPayments(userId: string, callback: (payments: Payment[]) => void) {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      callback(payments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PAYMENTS_COLLECTION);
    });
  },

  // Subscribe to all payments (Admin)
  subscribeToAllPayments(callback: (payments: Payment[]) => void) {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      callback(payments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PAYMENTS_COLLECTION);
    });
  }
};

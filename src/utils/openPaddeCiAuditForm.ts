import { auth } from '../firebase';
import toast from 'react-hot-toast';

/** Ouvre le formulaire PADDE-CI (nouvel onglet) si l’utilisateur est connecté. */
export function openPaddeCiAuditForm(formUrl: string): void {
  if (!auth.currentUser) {
    toast.error('Vous devez être connecté pour demander un audit.');
    return;
  }

  const toastId = toast.loading('Redirection vers le formulaire PADDE-CI...');
  try {
    toast.success('Remplissez le formulaire pour finaliser votre demande d’audit.', { id: toastId });
    window.open(formUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Erreur audit PADDE:', error);
    toast.error('Erreur lors de la redirection vers le formulaire.', { id: toastId });
  }
}

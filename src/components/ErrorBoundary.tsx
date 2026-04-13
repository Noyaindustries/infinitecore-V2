import * as React from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'Une erreur inattendue est survenue.';
      
      // Try to parse Firestore error info
      try {
        if (errorMessage.includes('{"error":')) {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
            errorMessage = "Erreur de permission : Vous n'avez pas les droits nécessaires pour effectuer cette action.";
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Oups ! Quelque chose s'est mal passé.</h1>
            <p className="text-gray-600 mb-8">{errorMessage}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-[#2A4365] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#1e324d] transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }

    return (this as React.Component<Props, State>).props.children;
  }
}

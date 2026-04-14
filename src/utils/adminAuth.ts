import { apiRequest } from '../lib/apiClient';

export const createUserAsAdmin = async (
  email: string,
  password?: string,
  role?: 'admin' | 'commando' | 'developer' | 'partner' | 'client'
) => {
  try {
    const result = await apiRequest<{ success: boolean; uid: string; password: string }>('/api/auth/admin-create', {
      method: 'POST',
      body: JSON.stringify({
        email,
        ...(role ? { role } : {}),
        ...(password ? { password } : {}),
      }),
    });

    return {
      uid: result.uid,
      password: result.password,
      success: true
    };
  } catch (error) {
    console.error("Error creating user in secondary app:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue.";
    return {
      uid: null,
      password: null,
      success: false,
      error: errorMessage
    };
  }
};

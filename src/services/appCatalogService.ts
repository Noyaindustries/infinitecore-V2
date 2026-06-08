import { apiRequest } from '@/lib/apiClient';
import type { AppCatalogEntry } from '@/data/appCatalog';
import { INFINITE_APP_CATALOG, mergeCatalogWithDefaults } from '@/data/appCatalog';

export const appCatalogService = {
  async fetchCatalog(): Promise<AppCatalogEntry[]> {
    try {
      const data = await apiRequest<{ success: boolean; apps?: AppCatalogEntry[] }>('/api/apps/catalog');
      if (data.apps?.length) {
        // Toujours fusionner avec le catalogue code (évite un vieux document Mongo obsolète).
        return mergeCatalogWithDefaults(data.apps);
      }
    } catch (error) {
      console.warn('[appCatalogService] fetchCatalog:', error);
    }
    return INFINITE_APP_CATALOG;
  },

  async saveCatalog(apps: AppCatalogEntry[]): Promise<AppCatalogEntry[]> {
    const data = await apiRequest<{ success: boolean; apps?: AppCatalogEntry[]; error?: string }>(
      '/api/apps/catalog',
      {
        method: 'PUT',
        body: JSON.stringify({ apps }),
      }
    );
    if (!data.apps?.length) {
      throw new Error(data.error || 'Enregistrement du catalogue impossible.');
    }
    return data.apps;
  },
};

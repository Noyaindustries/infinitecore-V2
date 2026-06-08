import { useCallback, useEffect, useState } from 'react';
import { INFINITE_APP_CATALOG, type AppCatalogEntry } from '@/data/appCatalog';
import { appCatalogService } from '@/services/appCatalogService';

export function useAppCatalog() {
  const [apps, setApps] = useState<AppCatalogEntry[]>(INFINITE_APP_CATALOG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await appCatalogService.fetchCatalog();
      setApps(catalog);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { apps, loading, refresh };
}

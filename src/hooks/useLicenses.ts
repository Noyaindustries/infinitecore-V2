import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { hasModuleAccess, isLicenseActive, type AppLicense } from '@/lib/licenses';
import { licenseService } from '../services/licenseService';

export function useLicenses() {
  const { user, userData } = useAuth();
  const [licenses, setLicenses] = useState<AppLicense[]>([]);
  const [loading, setLoading] = useState(true);

  const role = typeof userData?.role === 'string' ? userData.role : user?.role;
  const bypass = role === 'admin' || role === 'commando';

  useEffect(() => {
    if (!user?.uid) {
      setLicenses([]);
      setLoading(false);
      return;
    }
    const unsub = licenseService.subscribeToUserLicenses(user.uid, (data) => {
      setLicenses(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const activeLicenses = useMemo(
    () => licenses.filter((l) => isLicenseActive(l)),
    [licenses]
  );

  const canAccessModule = (moduleKey: string) =>
    hasModuleAccess(licenses, moduleKey, { bypass });

  return { licenses, activeLicenses, loading, bypass, canAccessModule };
}

import { useEffect, useState } from "react";
import * as SecureStore from 'expo-secure-store';
import { getCurrentProfile } from '../services/medirakshaApi';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      const token = await SecureStore.getItemAsync('userToken');
      const role = (await SecureStore.getItemAsync('userRole')) || 'Patient';

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getCurrentProfile(role);
        const currentProfile = { ...userData, role };

        setUser(userData);
        setProfile(currentProfile);
        await SecureStore.setItemAsync('userProfile', JSON.stringify(currentProfile));
      } catch (error: any) {
        if (error.response?.status === 401) {
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userRole');
          await SecureStore.deleteItemAsync('userProfile');
          setUser(null);
          setProfile(null);
        } else {
          const savedProfile = await SecureStore.getItemAsync('userProfile');
          let offlineProfile: any = { role };
          try {
            offlineProfile = savedProfile ? JSON.parse(savedProfile) : offlineProfile;
          } catch {
            // Keep the minimal role-based profile when cached data is malformed.
          }
          setUser(offlineProfile);
          setProfile({ ...offlineProfile, role });
        }
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);

  return { user, profile, loading };
}

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { getCurrentProfile } from '../services/medirakshaApi';

export function useAuthRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        router.replace('/Login');
        if (isMounted) setChecking(false);
        return;
      }

      try {
        const savedRole = await SecureStore.getItemAsync('userRole');
        const profile = await getCurrentProfile(savedRole === 'Doctor' ? 'Doctor' : 'Patient');
        if (!isMounted) return;

        const role = profile.role || savedRole || 'Patient';
        await SecureStore.setItemAsync('userRole', role);
        await SecureStore.setItemAsync('userProfile', JSON.stringify(profile));

        router.replace(
          role === 'Doctor'
            ? '/DoctorDashboard'
            : '/PatientDashboard'
        );
      } catch (err: any) {
        if (err.response?.status === 401) {
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userRole');
          await SecureStore.deleteItemAsync('userProfile');
          router.replace('/Login');
          return;
        }
        const role = await SecureStore.getItemAsync('userRole');
        router.replace(role === 'Doctor' ? '/DoctorDashboard' : '/PatientDashboard');
      } finally {
        if (isMounted) setChecking(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return checking; // optional loader control
}

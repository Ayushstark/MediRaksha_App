import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import * as SecureStore from 'expo-secure-store';

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
        const response = await API.get('/auth/profile');
        if (!isMounted) return;

        const role = response.data.profile?.role || 'Patient';

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

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import API from '../apiClient';

export function useAuthRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const response = await API.get('/auth/profile');
        if (!isMounted) return;

        const role = response.data.profile?.role || 'Patient';

        router.replace(
          role === 'Doctor'
            ? '/DoctorDashboard'
            : '/PatientDashboard'
        );
      } catch (err) {
        router.replace('/Login');
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

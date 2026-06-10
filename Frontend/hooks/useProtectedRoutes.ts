import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';

type Role = 'doctor' | 'patient';

export function useProtectedRoute(allowedRoles: Role[]) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // ❌ Not logged in
    if (!user) {
      router.replace('/Login');
      return;
    }

    // ❌ Profile missing
    if (!profile) {
      router.replace('/Login');
      return;
    }

    // ❌ Role not allowed
    const role = profile.role?.toLowerCase();
    if (!allowedRoles.includes(role)) {
      router.replace('/Login');
    }
  }, [loading, user, profile]);
}

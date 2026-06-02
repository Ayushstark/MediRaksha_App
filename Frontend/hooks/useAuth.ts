import { useEffect, useState } from "react";
import API from "../apiClient";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        // Fetch profile from Node.js backend
        // Your backend should return both basic user info and profile details
        const response = await API.get('/auth/profile');
        const userData = response.data;

        setUser(userData.user);
        setProfile(userData.profile);
      } catch (error) {
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);

  return { user, profile, loading };
}

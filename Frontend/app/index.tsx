import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getCurrentProfile } from '../services/medirakshaApi';


export default function WelcomeScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const router = useRouter();

  useEffect(() => {

    const boot = async () => {

      // 🎬 Animations
      Animated.sequence([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // 🔐 CHECK AUTHENTICATION STATE
      try {
        console.log('--- Checking for existing session...');
        const token = await SecureStore.getItemAsync('userToken');

        if (!token) {
          console.log('--- No token found in SecureStore. Redirecting to Login.');
          setTimeout(() => router.replace('/Login'), 2000);
          return;
        }

        const savedRole = await SecureStore.getItemAsync('userRole');
        const roleHint = savedRole === 'Doctor' ? 'Doctor' : 'Patient';
        const userData = await getCurrentProfile(roleHint);
        const role = userData.role || roleHint;
        await SecureStore.setItemAsync('userRole', role || 'Patient');
        await SecureStore.setItemAsync('userProfile', JSON.stringify({ ...userData, role: role || 'Patient' }));

        console.log('--- Session Validated! Role:', role);

        if (role) {
          setTimeout(() => {
            router.replace(role === 'Doctor' ? '/DoctorDashboard' : '/PatientDashboard');
          }, 2000);
        } else {
          console.warn('--- Session valid but missing role, fallback to Patient.');
          setTimeout(() => router.replace('/PatientDashboard'), 2000);
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userRole');
          await SecureStore.deleteItemAsync('userProfile');
          setTimeout(() => router.replace('/Login'), 2000);
          return;
        }

        const savedRole = await SecureStore.getItemAsync('userRole');
        console.warn('--- Auth validation unavailable; preserving saved session:', error?.response?.status || error?.message);
        setTimeout(() => router.replace(savedRole === 'Doctor' ? '/DoctorDashboard' : '/PatientDashboard'), 2000);
      }
    };

    boot();
    return undefined;
  }, []);

  return (
    <LinearGradient
      colors={['#e0f7fa', '#80deea']}
      style={styles.container}
    >
      <Animated.Image
        source={require('../assets/images/app_logo.png')}
        style={[styles.logo, { opacity: logoOpacity }]}
        resizeMode="contain"
      />

      <Animated.Text
        style={[
          styles.greeting,
          {
            transform: [{ translateY: textTranslateY }],
            opacity: textOpacity,
          },
        ]}
      >
        Welcome to MediRaksha
      </Animated.Text>

      <ActivityIndicator
        size="large"
        color="#007BFF"
        style={{ marginTop: 40 }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '80%',
    height: 220,
  },
  greeting: {
    fontSize: 26,
    marginTop: 30,
    fontWeight: 'bold',
    color: '#007BFF',
  },
});


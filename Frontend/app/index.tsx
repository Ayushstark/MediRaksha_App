import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import API from '../apiClient';
import * as SecureStore from 'expo-secure-store';


export default function WelcomeScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const router = useRouter();

  useEffect(() => {
    let sound: Audio.Sound | null = null;

    const boot = async () => {
      // 🎵 Optional sound
      Audio.Sound.createAsync(
        require('../assets/welcome.mp3.mp3')
      ).then(({ sound: s }) => {
        sound = s;
        sound.playAsync();
      }).catch(err => {
        console.warn("Audio load failed:", err);
      });

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

        // Fetch profile from Node.js backend to verify session
        const response = await API.get('/auth/profile');
        const userData = response.data;
        const role = userData.role;

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
        console.error('--- Auth Check Failed:', error.message);
        if (error.response) {
          console.log('--- Status:', error.response.status);
          console.log('--- Server Data:', JSON.stringify(error.response.data));
        }

        // If it's a server error (500, 502, 503) instead of 401, maybe don't force login immediately?
        // But for safety, we go to Login if we can't verify the session.
        await SecureStore.deleteItemAsync('userToken');
        setTimeout(() => router.replace('/Login'), 2000);
      }
    };

    boot();

    return () => {
      sound?.unloadAsync();
    };
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
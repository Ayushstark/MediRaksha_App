// AppNavigator.tsx

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';

// Import your existing app screens
import WelcomeScreen from '../app/Welcome';
import LoginScreen from '../app/Login';
import SignupScreen from '../app/Signup';
import PatientDashboard from '../app/PatientDashboard';
import DoctorDashboard from '../app/DoctorDashboard';
import AIassistantScreen from '../app/AIassistant';
import EditProfileScreen from '../app/EditProfile';
import YourReportsScreen from '../app/YourReports';
import ForgotPasswordScreen from '../app/ForgotPassword';
import DoctorChat from '../app/DoctorChat';
import MapScreen from '../app/MapScreen';
import NearbyHospitalsScreen from '../app/NearbyHospitals';
import HospitalDetailsScreen from '../app/HospitalDetails';

export type PatientStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  PatientTabs: undefined;
  PatientDashboard: undefined;
  AIassistant: undefined;
  AIDiagnosis: undefined;
  YourReports: undefined;
  NearbyHospitals: undefined;
  EmergencyServices: undefined;
  EditProfile: undefined;
  Map: { centerCoords?: { latitude: number; longitude: number; name?: string } } | undefined;
  HospitalDetails: { hospital: HospitalType };
};

export type DoctorStackParamList = {
  DoctorReports: undefined;
  DoctorDashboard: undefined;
  DoctorChat: undefined;
  AIassistant: undefined;
  DoctorTabs: undefined;
};

export type HospitalType = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  speciality: string;
  address: string;
  distanceMeters?: number;
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PatientTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Dashboard"
        component={PatientDashboard}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="AI Assistant"
        component={AIassistantScreen}
        options={{
          tabBarIcon: ({ color, size }) => <FontAwesome5 name="robot" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={YourReportsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Hospitals"
        component={NearbyHospitalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="location" color={color} size={size} />,
          headerShown: true,
          title: 'Nearby Hospitals',
        }}
      />
      {/* Uncomment and add EmergencyServicesScreen if needed */}
      {/* <Tab.Screen
        name="Emergency"
        component={EmergencyServicesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="emergency" color={color} size={size} />,
        }}
      /> */}
    </Tab.Navigator>
  );
}

function DoctorTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Dashboard"
        component={DoctorDashboard}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="medkit" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="AI Assistant"
        component={AIassistantScreen}
        options={{
          tabBarIcon: ({ color, size }) => <FontAwesome5 name="robot" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'doctor') {
          setInitialRoute('DoctorTabs');
        } else {
          setInitialRoute('PatientTabs');
        }
      } else {
        setInitialRoute('Welcome');
      }
    };

    checkSession();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        {/* Authentication Screens */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* Main Tabs */}
        <Stack.Screen name="PatientTabs" component={PatientTabs} />
        <Stack.Screen name="DoctorTabs" component={DoctorTabs} />

        {/* Standalone Screens */}
        <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
        <Stack.Screen name="DoctorDashboard" component={DoctorDashboard} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="YourReports" component={YourReportsScreen} />
        <Stack.Screen name="AIassistant" component={AIassistantScreen} />
        <Stack.Screen name="DoctorChat" component={DoctorChat} />

        {/* Hospital-related Screens Added */}
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{ headerShown: true, title: 'Hospital Map' }}
        />
        <Stack.Screen
          name="NearbyHospitals"
          component={NearbyHospitalsScreen}
          options={{ headerShown: true, title: 'Nearby Hospitals' }}
        />
        <Stack.Screen
          name="HospitalDetails"
          component={HospitalDetailsScreen}
          options={{ headerShown: true, title: 'Hospital Details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}


import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Signup"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PatientDashboard"
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back to login
        }}
      />
      <Stack.Screen
        name="DoctorDashboard"
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back to login
        }}
      />
      <Stack.Screen
        name="AIDiagnosis"
        options={{
          headerShown: false,
          title: 'AI Diagnosis',
        }}
      />
      <Stack.Screen
        name="BookBed"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen name="MyBedBookings" options={{ headerShown: false }} />
      </Stack>
  );
}
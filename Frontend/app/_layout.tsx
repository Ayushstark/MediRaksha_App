import { Stack } from 'expo-router';
import { ToastProvider } from '../components/ui/ToastProvider';

export default function RootLayout() {
  return (
    <ToastProvider>
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F5F7FB' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="Login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="Signup" options={{ headerShown: false }} />
        <Stack.Screen name="PatientDashboard" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="DoctorDashboard" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="AIDiagnosis" options={{ headerShown: false, title: 'AI Diagnosis' }} />
        <Stack.Screen name="BookAppointment" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="DoctorDetails" options={{ headerShown: false }} />
        <Stack.Screen name="UpcomingAppointments" options={{ headerShown: false }} />
        <Stack.Screen name="NotificationCenter" options={{ headerShown: false }} />
        <Stack.Screen name="BookBed" options={{ headerShown: false }} />

        <Stack.Screen name="MyBedBookings" options={{ headerShown: false }} />
        <Stack.Screen name="MediConnect" options={{ headerShown: false }} />
        <Stack.Screen name="SOS" options={{ headerShown: false }} />
      </Stack>
    </ToastProvider>
  );
}

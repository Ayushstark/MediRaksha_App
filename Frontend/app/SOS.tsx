import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createEmergency, EmergencyResponse } from '../services/emergencyApi';

export default function SOS() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'locating' | 'sending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<EmergencyResponse | null>(null);
  const [error, setError] = useState('');

  const call112 = () => Linking.openURL('tel:112').catch(() => Alert.alert('Emergency', 'Please dial 112 immediately.'));

  const sendSOS = async () => {
    setError('');
    setStatus('locating');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission was denied.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true });
      setStatus('sending');
      const response = await createEmergency({ latitude: current.coords.latitude, longitude: current.coords.longitude, location_accuracy: current.coords.accuracy ?? undefined });
      setResult(response);
      setStatus('success');
    } catch (requestError: any) {
      const code = requestError?.response?.status;
      setError(code === 401 ? 'Please sign in before sending an SOS.' : code === 404 ? 'The emergency service is not live on the configured backend.' : requestError?.message || 'Emergency alert could not be sent.');
      setStatus('error');
    }
  };

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={22} color="#fff" /></TouchableOpacity><Text style={styles.headerTitle}>Emergency SOS</Text></View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
      <View style={styles.sosIcon}><Ionicons name="warning" size={42} color="#DC2626" /></View>
      <Text style={styles.title}>{status === 'success' ? 'Emergency services alerted' : 'Need urgent help?'}</Text>
      <Text style={styles.subtitle}>{status === 'success' ? 'Keep this emergency reference available for responders.' : 'MediRaksha will share your current location with the emergency service.'}</Text>
      {status === 'idle' || status === 'error' ? <TouchableOpacity style={styles.sosButton} onPress={sendSOS}><Ionicons name="navigate" size={24} color="#fff" /><Text style={styles.sosButtonText}>Send SOS with my location</Text></TouchableOpacity> : null}
      {status === 'locating' || status === 'sending' ? <View style={styles.progress}><ActivityIndicator color="#DC2626" /><Text style={styles.progressText}>{status === 'locating' ? 'Getting your location...' : 'Alerting emergency services...'}</Text></View> : null}
      {status === 'error' ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      {result ? <View style={styles.result}><Text style={styles.resultTitle}>Emergency ID</Text><Text style={styles.resultValue}>{result.emergency_id}</Text><Text style={styles.resultTitle}>Token</Text><Text style={styles.token}>{result.emergency_token}</Text><Text style={styles.expiry}>Expires {new Date(result.token_expires_at).toLocaleString()}</Text><Text style={styles.qrLabel}>Responder QR payload</Text><Text style={styles.qrPayload}>{result.qr_payload}</Text><Text style={styles.queued}>{result.family_notifications_queued || 0} family notification(s) queued</Text><TouchableOpacity style={styles.share} onPress={() => Share.share({ message: `MediRaksha emergency token: ${result.emergency_token}` })}><Feather name="share-2" size={17} color="#1A237E" /><Text style={styles.shareText}>Share emergency token</Text></TouchableOpacity></View> : null}
      <TouchableOpacity style={styles.callButton} onPress={call112}><Ionicons name="call" size={19} color="#991B1B" /><Text style={styles.callText}>Call 112 immediately</Text></TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7F7' }, flex: { flex: 1 }, header: { backgroundColor: '#991B1B', paddingTop: 22, paddingHorizontal: 18, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, back: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: '#fff', fontSize: 21, fontWeight: '900' }, content: { flexGrow: 1, padding: 22, paddingBottom: 36, alignItems: 'center' }, sosIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginTop: 26 }, title: { color: '#450A0A', fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 20 }, subtitle: { color: '#7F1D1D', textAlign: 'center', lineHeight: 21, marginTop: 8, maxWidth: 360 }, sosButton: { width: '100%', backgroundColor: '#DC2626', borderRadius: 18, padding: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 28 }, sosButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'center', flexShrink: 1 }, progress: { alignItems: 'center', padding: 28 }, progressText: { color: '#991B1B', fontWeight: '800', marginTop: 10, textAlign: 'center' }, error: { width: '100%', backgroundColor: '#FEE2E2', borderRadius: 16, padding: 14, marginTop: 16 }, errorText: { color: '#991B1B', textAlign: 'center', lineHeight: 19 }, result: { width: '100%', marginTop: 22, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#FECACA' }, resultTitle: { color: '#7F1D1D', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 9 }, resultValue: { color: '#450A0A', fontSize: 17, fontWeight: '900', marginTop: 4, flexShrink: 1 }, token: { color: '#1E293B', fontSize: 14, marginTop: 4, flexShrink: 1 }, expiry: { color: '#64748B', fontSize: 12, marginTop: 6 }, qrLabel: { color: '#7F1D1D', fontSize: 11, fontWeight: '900', marginTop: 16 }, qrPayload: { color: '#475569', fontSize: 11, marginTop: 4 }, queued: { color: '#047857', fontWeight: '800', marginTop: 14, textAlign: 'center' }, share: { marginTop: 16, borderRadius: 13, backgroundColor: '#EEF2FF', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, shareText: { color: '#1A237E', fontWeight: '900' }, callButton: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }, callText: { color: '#991B1B', fontWeight: '900' },
});

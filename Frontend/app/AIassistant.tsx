import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AssistantHistoryItem, chatWithAssistantLLM } from '../services/huggingFaceService';

const welcomeMessage = 'Hello! Tell me what symptom is bothering you most, and I will ask a few focused questions to better understand it.';

export default function MediRakshaGuideScreen() {
  const router = useRouter();
  const [guideText, setGuideText] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantHistoryItem[]>([
    { role: 'assistant', content: welcomeMessage },
  ]);
  const [error, setError] = useState<string | null>(null);

  // Removed legacy health check

  const askGuide = async () => {
    if (!guideText.trim()) return;
    setLoading(true);
    setError(null);
    const message = guideText.trim();
    const history = messages.filter(item => item.content !== welcomeMessage);
    setMessages(current => [...current, { role: 'user', content: message }]);
    setGuideText('');

    try {
      const responseText = await chatWithAssistantLLM(message, history);
      setMessages(current => [...current, { role: 'assistant', content: responseText }]);
    } catch (err: any) {
      setError(err?.message || 'An error occurred while connecting to AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A237E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>MediRaksha Assistant</Text>
        </View>
        <View style={styles.rightBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.chatSection}>
          {messages.map((item, index) => (
            <View
              key={`${item.role}-${index}`}
              style={item.role === 'user' ? styles.userMessage : styles.aiMessage}
            >
              {item.role === 'assistant' && (
                <View style={styles.aiAvatar}>
                  <FontAwesome5 name="robot" size={20} color="#fff" />
                </View>
              )}
              <View style={item.role === 'user' ? styles.userBubble : styles.messageBubble}>
                <Text style={item.role === 'user' ? styles.userMessageText : styles.messageText}>
                  {item.content}
                </Text>
              </View>
            </View>
          ))}


          {loading && (
            <ActivityIndicator size="small" color="#1A237E" style={{ marginLeft: 60, marginTop: 10 }} />
          )}

          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </View>

        <View style={styles.bottomSection}>
          <TextInput
            style={styles.input}
            placeholder="Ask about symptoms or the app..."
            multiline
            value={guideText}
            onChangeText={setGuideText}
          />
          <TouchableOpacity
            style={[styles.sendButton, !guideText.trim() && styles.disabledSend]}
            onPress={askGuide}
            disabled={loading || guideText.trim() === ''}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  rightBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
  container: { flexGrow: 1, backgroundColor: '#F0F2F5' },
  chatSection: { flex: 1, padding: 20 },
  aiMessage: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  userMessage: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageBubble: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    borderTopLeftRadius: 2,
    maxWidth: '80%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: { fontSize: 15, color: '#333', lineHeight: 22 },
  userBubble: {
    backgroundColor: '#1A237E',
    padding: 15,
    borderRadius: 15,
    borderTopRightRadius: 2,
    maxWidth: '80%',
  },
  userMessageText: { fontSize: 15, color: '#fff', lineHeight: 22 },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#1A237E',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSend: { backgroundColor: '#999' },
  errorText: { marginTop: 20, color: '#d32f2f', textAlign: 'center' },
});

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Linking,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, Feather } from '@expo/vector-icons';
import API from '../apiClient';

export default function DoctorChat() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [userId, setUserId] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const fetchUserAndMessages = async () => {
            try {
                const response = await API.get('/auth/profile');
                setUserId(response.data.user._id);

                const msgRes = await API.get('/messages');
                setMessages(msgRes.data);
            } catch (error: any) {
                console.error('Chat Init Error:', error);
                Alert.alert('Error', 'Unable to load chat messages.');
            } finally {
                setLoading(false);
            }
        };

        fetchUserAndMessages();
    }, []);

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        setSending(true);
        try {
            const res = await API.post('/messages', {
                content: newMessage,
                receiverId: 'admin', // Placeholder
            });
            setMessages(prev => [res.data, ...prev]);
            setNewMessage('');
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || error.message);
        } finally {
            setSending(false);
        }
    };

    const sendFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (result.canceled || !result.assets?.length) return;

            setSending(true);
            const file = result.assets[0];

            const formData = new FormData();
            formData.append('file', {
                uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
            } as any);

            const uploadRes = await API.post('/chat/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const fileUrl = uploadRes.data.fileUrl;

            const res = await API.post('/messages', {
                content: `📎 File: ${file.name}\n${fileUrl}`,
                receiverId: 'admin',
            });
            setMessages(prev => [res.data, ...prev]);
        } catch (error: any) {
            Alert.alert('Upload Error', error.response?.data?.message || error.message);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.senderId === userId || item.sender_id === userId;
        const isFile = item.content.startsWith('📎 File:');
        const contentParts = item.content.split('\n');
        const fileName = isFile ? contentParts[0] : '';
        const fileUrl = isFile ? contentParts[1] : '';

        return (
            <View style={[styles.message, isMine ? styles.mine : styles.theirs]}>
                {isFile ? (
                    <TouchableOpacity onPress={() => Linking.openURL(fileUrl)}>
                        <Text style={styles.fileText}>{fileName}</Text>
                        <Text style={styles.downloadText}>Tap to view</Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={isMine ? styles.mineText : styles.theirsText}>{item.content}</Text>
                )}
                <Text style={styles.timeText}>
                    {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Doctor Chat</Text>
                <Text style={styles.headerSubtitle}>Real-time assistance</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1A237E" />
                </View>
            ) : (
                <FlatList
                    data={messages}
                    keyExtractor={(item) => item.$id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    inverted
                />
            )}

            <View style={styles.inputBar}>
                <TouchableOpacity onPress={sendFile} style={styles.attachButton}>
                    <Feather name="plus" size={24} color="#1A237E" />
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                />
                <TouchableOpacity
                    onPress={sendMessage}
                    style={[styles.sendButton, (!newMessage.trim() || sending) && styles.disabledSend]}
                    disabled={!newMessage.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F2F5',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E1E8ED',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A237E',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#666',
    },
    listContent: {
        padding: 15,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        padding: 12,
        marginVertical: 4,
        borderRadius: 15,
        maxWidth: '80%',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    mine: {
        backgroundColor: '#1A237E',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2,
    },
    theirs: {
        backgroundColor: '#fff',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 2,
    },
    mineText: {
        color: '#fff',
        fontSize: 15,
    },
    theirsText: {
        color: '#333',
        fontSize: 15,
    },
    fileText: {
        color: '#1E88E5',
        textDecorationLine: 'underline',
        fontWeight: 'bold',
    },
    downloadText: {
        fontSize: 10,
        color: '#666',
        marginTop: 2,
    },
    timeText: {
        fontSize: 10,
        color: '#999',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E1E8ED',
    },
    attachButton: {
        padding: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#F0F2F5',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginHorizontal: 8,
        maxHeight: 100,
        fontSize: 15,
    },
    sendButton: {
        backgroundColor: '#1A237E',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledSend: {
        backgroundColor: '#999',
    },
});

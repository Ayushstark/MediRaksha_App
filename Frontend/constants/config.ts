import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrls = () => {
    const configuredUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (configuredUrl) return [configuredUrl];

    const expoConstants = Constants as any;
    const hostUri =
        Constants.expoConfig?.hostUri ||
        expoConstants.manifest2?.extra?.expoGo?.debuggerHost ||
        expoConstants.manifest?.debuggerHost;
    const host = hostUri?.split(':')[0];
    const urls = [
        host ? `http://${host}:8000/api` : undefined,
        Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : undefined,
        'http://127.0.0.1:8000/api',
        'http://localhost:8000/api',
    ].filter(Boolean) as string[];

    return [...new Set(urls)];
};

export const BACKEND_URLS = getBackendUrls();
export const BACKEND_URL = BACKEND_URLS[0];

export const API_ENDPOINTS = {
    AUTH: '/auth',
    PROFILE: '/auth/profile',
    REPORTS: '/reports',
    DOCTOR: '/doctor',
};

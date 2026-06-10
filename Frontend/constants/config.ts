import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrls = () => {
    const configuredUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

    const expoConstants = Constants as any;
    const hostUri =
        Constants.expoConfig?.hostUri ||
        expoConstants.manifest2?.extra?.expoGo?.debuggerHost ||
        expoConstants.manifest?.debuggerHost;
    const host = hostUri?.split(':')[0];
    const urls = [
        configuredUrl,
        host ? `http://${host}:3000/api` : undefined,
        Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : undefined,
        'http://127.0.0.1:3000/api',
        'http://localhost:3000/api',
    ].filter(Boolean) as string[];

    return [...new Set(urls)];
};

export const BACKEND_URLS = getBackendUrls();
export const BACKEND_URL = BACKEND_URLS[0];

export const API_ENDPOINTS = {
    AUTH: '/auth',
    PROFILE: '/user/info/detail',
    REPORTS: '/user/report',
    DOCTOR: '/doctor',
};

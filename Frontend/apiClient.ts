import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL, BACKEND_URLS } from './constants/config';

let isLoggingOut = false;

const apiClient = axios.create({
    baseURL: BACKEND_URL,
    timeout: 25000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

apiClient.interceptors.request.use(async (config) => {
    config.withCredentials = true;

    try {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch {
        // Handle SecureStore reading safely across platforms
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config || {};
        const url = String(config.url || '');
        const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/signup');

        // Handle 401 Unauthorized (Expired or Invalid Token)
        if (error.response?.status === 401 && !isAuthRequest) {
            if (!isLoggingOut) {
                isLoggingOut = true;
                try {
                    await SecureStore.deleteItemAsync('userToken').catch(() => {});
                    await SecureStore.deleteItemAsync('userRole').catch(() => {});
                    await SecureStore.deleteItemAsync('userName').catch(() => {});
                    console.warn('[apiClient] Session expired. Stored tokens cleared.');
                } finally {
                    setTimeout(() => {
                        isLoggingOut = false;
                    }, 3000);
                }
            }
            return Promise.reject(error);
        }

        // Handle Network Faults / Offline / Timeout with fallback to alternative backend URLs
        if (error.message === 'Network Error' || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            const method = String(config.method || 'get').toLowerCase();
            const canRetryOnAnotherBackend = ['get', 'head', 'options'].includes(method);
            if (!canRetryOnAnotherBackend) {
                return Promise.reject(error);
            }

            const retryConfig = config as typeof config & { __attemptedBaseUrls?: string[] };
            const attemptedUrls: string[] = retryConfig.__attemptedBaseUrls || [config.baseURL || String(apiClient.defaults.baseURL)];
            const nextBaseUrl = BACKEND_URLS.find((u) => !attemptedUrls.includes(u));

            if (nextBaseUrl) {
                console.warn(`[apiClient] Connection failed on ${attemptedUrls[attemptedUrls.length - 1]}${config.url || ''}`);
                console.warn(`[apiClient] Retrying on next host: ${nextBaseUrl}${config.url || ''}`);
                return apiClient.request({
                    ...config,
                    baseURL: nextBaseUrl,
                    __attemptedBaseUrls: [...attemptedUrls, nextBaseUrl],
                } as typeof config);
            }

            console.warn(`[apiClient] Backend unavailable after testing hosts: ${attemptedUrls.join(', ')}`);
        }
        return Promise.reject(error);
    }
);

export default apiClient;

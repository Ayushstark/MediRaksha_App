import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL, BACKEND_URLS } from './constants/config';

const apiClient = axios.create({
    baseURL: BACKEND_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

apiClient.interceptors.request.use(async (config) => {
    config.withCredentials = true;

    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.message === 'Network Error' || error.code === 'ECONNABORTED') {
            const config = error.config || {};
            const method = String(config.method || 'get').toLowerCase();
            const canRetryOnAnotherBackend = ['get', 'head', 'options'].includes(method);
            if (!canRetryOnAnotherBackend) {
                return Promise.reject(error);
            }

            const retryConfig = config as typeof config & { __attemptedBaseUrls?: string[] };
            const attemptedUrls: string[] = retryConfig.__attemptedBaseUrls || [config.baseURL || String(apiClient.defaults.baseURL)];
            const nextBaseUrl = BACKEND_URLS.find((url) => !attemptedUrls.includes(url));

            if (nextBaseUrl) {
                console.warn(`API connection failed: ${attemptedUrls[attemptedUrls.length - 1]}${config.url || ''}`);
                console.warn(`Retrying API request with: ${nextBaseUrl}${config.url || ''}`);
                return apiClient.request({
                    ...config,
                    baseURL: nextBaseUrl,
                    __attemptedBaseUrls: [...attemptedUrls, nextBaseUrl],
                } as typeof config);
            }

            console.error(`API connection failed after trying: ${attemptedUrls.join(', ')}`);
        }
        return Promise.reject(error);
    }
);

export default apiClient;

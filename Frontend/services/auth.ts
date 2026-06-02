import API from '../apiClient';
import * as SecureStore from 'expo-secure-store';

export const signup = async (
  email: string,
  password: string,
  fullname: string,
  role: string = 'Patient',
  age?: number,
  gender?: string,
  phone?: string
) => {
  const normalizedEmailOrId = email.trim().toLowerCase();
  const endpoint = role === 'Doctor' ? '/auth/doctor/' : '/auth/';
  const requestData = role === 'Doctor'
    ? { doctorId: normalizedEmailOrId, password }
    : { name: fullname, email: normalizedEmailOrId, password, age, gender, phoneNumber: phone };

  const response = await API.post(endpoint, requestData);
  console.log(`--- AUTH DEBUG [Signup]: Data keys: ${Object.keys(response.data)}`);

  // Backend might return token in 'token' or 'msg' field
  const { token, user } = response.data;
  const finalToken = token || response.data.msg;

  if (finalToken && typeof finalToken === 'string' && finalToken.length > 20) {
    console.log(`--- AUTH DEBUG [Signup]: Saving valid token (length: ${finalToken.length})`);
    await SecureStore.setItemAsync('userToken', finalToken);
  } else {
    console.warn('--- AUTH DEBUG [Signup]: NO VALID TOKEN FOUND in response body! Keys:', Object.keys(response.data));
  }

  return { token: finalToken, user: user || { role } };
};

export const login = async (
  emailOrId: string,
  password: string,
  role: string = 'Patient'
) => {
  const normalizedEmailOrId = emailOrId.trim().toLowerCase();
  const endpoint = role === 'Doctor' ? '/auth/doctor/login' : '/auth/login';
  const requestData = role === 'Doctor'
    ? { doctorId: normalizedEmailOrId, password }
    : { email: normalizedEmailOrId, password };

  const response = await API.post(endpoint, requestData);
  console.log(`--- AUTH DEBUG [Login]: Data keys: ${Object.keys(response.data)}`);

  // Backend might return token in 'token' or 'msg' field
  const { token, user } = response.data;
  const finalToken = token || response.data.msg;

  if (finalToken && typeof finalToken === 'string' && finalToken.length > 20) {
    console.log(`--- AUTH DEBUG [Login]: Saving valid token (length: ${finalToken.length})`);
    await SecureStore.setItemAsync('userToken', finalToken);
  } else {
    console.warn('--- AUTH DEBUG [Login]: NO VALID TOKEN FOUND in response body! Keys:', Object.keys(response.data));
  }

  return { token: finalToken, user: user || { role } };
};

export const logout = async () => {
  try {
    await API.post('/auth/logout');
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    await SecureStore.deleteItemAsync('userToken');
    console.log('--- AUTH: Token cleared from SecureStore');
  }
};

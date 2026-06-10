import API from '../apiClient';
import * as SecureStore from 'expo-secure-store';

const saveSession = async (token: string | undefined, role: string, user: any) => {
  if (token && token.length > 20) {
    await SecureStore.setItemAsync('userToken', token);
  }
  await SecureStore.setItemAsync('userRole', role);
  if (user) {
    await SecureStore.setItemAsync('userProfile', JSON.stringify({ ...user, role }));
  }
};

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
  const isDoctor = role === 'Doctor';
  const endpoint = isDoctor ? '/auth/doctor/signup' : '/auth/signup';
  const normalizedGender = gender?.trim().toLowerCase();
  const requestData = role === 'Doctor'
    ? {
      name: fullname,
      email: normalizedEmailOrId,
      number: phone,
      age,
      gender: normalizedGender,
      hospital: '',
      speciality: 'General',
      password
    }
    : {
      name: fullname,
      email: normalizedEmailOrId,
      password,
      age,
      gender: normalizedGender,
      number: phone
    };

  const response = await API.post(endpoint, requestData);
  console.log(`--- AUTH DEBUG [Signup]: Data keys: ${Object.keys(response.data)}`);

  const { token, user, doctor } = response.data;
  const finalToken = token || response.data.msg;

  if (finalToken && typeof finalToken === 'string' && finalToken.length > 20) {
    console.log(`--- AUTH DEBUG [Signup]: Saving valid token (length: ${finalToken.length})`);
  }
  const finalRole = isDoctor ? 'Doctor' : 'Patient';
  const finalUser = user || doctor || { role: finalRole };
  await saveSession(finalToken, finalRole, finalUser);

  return { token: finalToken, user: finalUser };
};

export const login = async (
  emailOrId: string,
  password: string,
  role: string = 'Patient'
) => {
  const normalizedEmailOrId = emailOrId.trim().toLowerCase();
  const isDoctor = role === 'Doctor';
  const endpoint = role === 'Doctor' ? '/auth/doctor/login' : '/auth/login';
  const requestData = role === 'Doctor'
    ? { email: normalizedEmailOrId, password }
    : { email: normalizedEmailOrId, password };

  const response = await API.post(endpoint, requestData);
  console.log(`--- AUTH DEBUG [Login]: Data keys: ${Object.keys(response.data)}`);

  const { token, user, doctor } = response.data;
  const finalToken = token || response.data.msg;

  if (finalToken && typeof finalToken === 'string' && finalToken.length > 20) {
    console.log(`--- AUTH DEBUG [Login]: Saving valid token (length: ${finalToken.length})`);
  }
  const finalRole = isDoctor ? 'Doctor' : 'Patient';
  const finalUser = user || doctor || { role: finalRole };
  await saveSession(finalToken, finalRole, finalUser);

  return { token: finalToken, user: finalUser };
};

export const logout = async () => {
  try {
    await API.post('/auth/logout');
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('userProfile');
    console.log('--- AUTH: Token cleared from SecureStore');
  }
};

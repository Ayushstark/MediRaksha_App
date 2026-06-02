import {
  Client,
  Account,
  Databases,
} from 'react-native-appwrite';

const client = new Client();

client
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('695a04f1002eca51706d')
  .setPlatform('com.mediraksha.app'); 
// 👆 MUST MATCH APPWRITE PLATFORM ID

export const account = new Account(client);
export const databases = new Databases(client);

export const DATABASE_ID = '695a050b002428cc94c7';
export const USERS_COLLECTION_ID = 'users';

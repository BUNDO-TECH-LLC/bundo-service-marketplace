import admin from 'firebase-admin';
import { env } from './env';

function usesPlaceholderFirebaseKey(privateKey: string) {
  return !privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY');
}

function resolveFirebaseCredential() {
  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  if (env.NODE_ENV === 'test' && usesPlaceholderFirebaseKey(privateKey)) {
    return {
      getAccessToken: async () => ({
        access_token: 'test-token',
        expires_in: 3600,
      }),
    } as admin.credential.Credential;
  }

  return admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: resolveFirebaseCredential(),
    projectId: env.FIREBASE_PROJECT_ID,
  });
}

export default admin;

import type { User } from 'firebase/auth';
import { api, ApiError, AUTH_API_TIMEOUT_MS } from './api';
import type { ApiUser } from '../types';

export async function resolveApiSession(user: User, forceRefresh = false) {
  let idToken = await user.getIdToken(forceRefresh);

  try {
    const response = await api<{ user: ApiUser }>('/me', {
      token: idToken,
      timeoutMs: AUTH_API_TIMEOUT_MS,
    });
    return { token: idToken, user: response.user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw error;
    }

    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    idToken = await user.getIdToken(true);
    const retryResponse = await api<{ user: ApiUser }>('/me', {
      token: idToken,
      timeoutMs: AUTH_API_TIMEOUT_MS,
    });
    return { token: idToken, user: retryResponse.user };
  }
}

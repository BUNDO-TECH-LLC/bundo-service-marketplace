import type { User } from 'firebase/auth';
import type { ApiUser } from '../types';

export function userDisplayName(firebaseUser: User | null, me: ApiUser | null) {
  const name = firebaseUser?.displayName?.trim();

  if (name) {
    return name.split(' ')[0];
  }

  const email = firebaseUser?.email || me?.email;

  if (!email) {
    return 'Account';
  }

  return email.split('@')[0].split(/[._-]/)[0] || 'Account';
}

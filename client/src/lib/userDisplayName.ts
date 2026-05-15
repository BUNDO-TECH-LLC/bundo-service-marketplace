import type { User } from 'firebase/auth';
import type { ApiUser } from '../types';

export function capitalizeLeadingCharacter(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  return `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1)}`;
}

export function userDisplayName(firebaseUser: User | null, me: ApiUser | null) {
  const name = firebaseUser?.displayName?.trim();

  if (name) {
    return capitalizeLeadingCharacter(name.split(' ')[0]);
  }

  const email = firebaseUser?.email || me?.email;

  if (!email) {
    return 'Account';
  }

  return capitalizeLeadingCharacter(email.split('@')[0].split(/[._-]/)[0] || 'Account');
}

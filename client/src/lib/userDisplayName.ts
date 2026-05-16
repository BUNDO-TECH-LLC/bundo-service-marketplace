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

export function userFullDisplayName(firebaseUser: User | null, me: ApiUser | null) {
  const name = firebaseUser?.displayName?.trim();

  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => capitalizeLeadingCharacter(part))
      .join(' ');
  }

  const email = firebaseUser?.email || me?.email;

  if (!email) {
    return 'Account';
  }

  const local = email.split('@')[0];
  return capitalizeLeadingCharacter(local.replace(/[._-]+/g, ' ').trim() || 'Account');
}

export function userHandle(firebaseUser: User | null, me: ApiUser | null) {
  const email = firebaseUser?.email || me?.email;

  if (!email) {
    return '@account';
  }

  const handle = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return `@${handle || 'account'}`;
}

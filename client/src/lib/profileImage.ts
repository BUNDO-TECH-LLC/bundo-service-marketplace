import type { User } from 'firebase/auth';
import type { Artisan } from '../types';

export function customerProfileImageUrl(firebaseUser: User | null) {
  return firebaseUser?.photoURL || null;
}

export function artisanProfileImageUrl(artisan?: Artisan | null) {
  return artisan?.portfolioImages?.[0]?.url || artisan?.kycSubmission?.selfieImageUrl || null;
}

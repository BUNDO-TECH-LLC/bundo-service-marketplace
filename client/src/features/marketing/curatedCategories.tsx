import type { ReactNode } from 'react';
import type { Category } from '../../types';

export const curatedCategoryCards: {
  matchSlugs: string[];
  title: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    matchSlugs: ['plumbing', 'plumber', 'plumbers'],
    title: 'Plumbing',
    description: 'Leaking pipes, installations, and repairs.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    matchSlugs: ['electrical', 'electrician', 'electric'],
    title: 'Electrical',
    description: 'Wiring, lighting, and smart home setup.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22v-4" />
        <path d="M9 12V7a3 3 0 0 1 6 0v5" />
        <rect x="5" y="12" width="14" height="8" rx="2" />
        <path d="M10 12V9" />
        <path d="M14 12V9" />
      </svg>
    ),
  },
  {
    matchSlugs: ['cleaning', 'cleaners', 'housekeeping'],
    title: 'Cleaning',
    description: 'Deep cleans and regular maintenance.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m16 22-1-4" />
        <path d="M19 13.99a1 1 0 0 0 .5-.866l-1-8a1 1 0 0 0-1.99.132L16 10" />
        <path d="m4.5 9.5-1 8a1 1 0 0 0 .5.866" />
        <path d="M8 18h8" />
        <path d="M12 18V2l4 4-4 4-4-4 4-4v16" />
      </svg>
    ),
  },
  {
    matchSlugs: ['carpentry', 'carpenter', 'woodwork', 'woodworking'],
    title: 'Carpentry',
    description: 'Custom furniture and structural woodwork.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m3 21 9-9" />
        <path d="m12 3 9 9-2 2-9-9" />
        <path d="M9 12l-6 6" />
        <path d="M14 7l3 3" />
      </svg>
    ),
  },
  {
    matchSlugs: ['painting', 'painter', 'paint'],
    title: 'Painting',
    description: 'Interior and exterior premium finishes.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
        <path d="M9 8c-2 3-4 3.5-7 4l11 11c.5-3 .5-5-1-7" />
        <path d="M14.5 17.5 4 7" />
      </svg>
    ),
  },
  {
    matchSlugs: ['gardening', 'garden', 'landscaping', 'landscape'],
    title: 'Gardening',
    description: 'Landscape design and garden care.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22c-4-3-6-6-6-9a6 6 0 0 1 12 0c0 3-2 6-6 9" />
        <path d="M12 13V8" />
        <path d="M9 10h6" />
        <circle cx="12" cy="5" r="2" />
      </svg>
    ),
  },
];

export function resolveCuratedCategory(categories: Category[], matchSlugs: string[]): Category | undefined {
  const lowered = matchSlugs.map((s) => s.toLowerCase());
  return categories.find((c) => {
    const slug = c.slug.toLowerCase();
    if (lowered.includes(slug)) return true;
    const nameSlug = c.name.toLowerCase().trim().replace(/\s+/g, '-');
    return lowered.includes(nameSlug);
  });
}

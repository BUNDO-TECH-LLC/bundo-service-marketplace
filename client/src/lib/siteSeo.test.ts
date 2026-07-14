import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENT_TITLE,
  documentTitleForPath,
  formatDocumentTitle,
  metaDescriptionForPath,
} from './siteSeo';

describe('siteSeo', () => {
  it('formats branded page titles', () => {
    expect(formatDocumentTitle('Help Center')).toBe('Help Center | Bundo');
    expect(formatDocumentTitle(DEFAULT_DOCUMENT_TITLE)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it('resolves public route titles', () => {
    expect(documentTitleForPath('/')).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(documentTitleForPath('/marketplace')).toBe('Browse services near you | Bundo');
    expect(documentTitleForPath('/terms')).toBe('Terms of Service | Bundo');
    expect(documentTitleForPath('/help/getting-started', { helpTopicTitle: 'Getting started with Bundo' })).toBe(
      'Getting started with Bundo | Bundo'
    );
  });

  it('resolves artisan titles when profile is loaded', () => {
    expect(
      documentTitleForPath('/artisans/abc', {
        artisan: { displayName: 'Ada Cleaning', city: 'Lagos' },
      })
    ).toBe('Ada Cleaning — Lagos | Bundo');

    expect(documentTitleForPath('/artisans/abc')).toBe('Artisan profile | Bundo');
  });

  it('returns marketplace-focused meta descriptions', () => {
    expect(metaDescriptionForPath('/marketplace')).toMatch(/Browse approved artisans/i);
    expect(metaDescriptionForPath('/')).toMatch(/Nigeria/i);
  });
});

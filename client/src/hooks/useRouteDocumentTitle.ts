import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { helpTopics } from '../help/helpTopics';
import {
  applyResolvedDocumentTitle,
  documentTitleForPath,
  metaDescriptionForPath,
  setMetaDescription,
} from '../lib/siteSeo';

type ArtisanSeoInput = {
  displayName?: string | null;
  city?: string | null;
} | null;

/**
 * Keeps document.title + meta description in sync with the current route.
 * Fail-soft: never throws into the React tree.
 */
export function useRouteDocumentTitle(selectedArtisan?: ArtisanSeoInput) {
  const location = useLocation();

  useEffect(() => {
    try {
      const path = location.pathname;
      let helpTopicTitle: string | null = null;

      if (path.startsWith('/help/')) {
        const topicId = path.replace(/^\/help\//, '').split('/')[0] || '';
        helpTopicTitle = helpTopics.find((topic) => topic.id === topicId)?.title ?? null;
      }

      const artisanMatchesRoute =
        Boolean(selectedArtisan) && path.startsWith('/artisans/');

      const title = documentTitleForPath(path, {
        artisan: artisanMatchesRoute ? selectedArtisan : null,
        helpTopicTitle,
      });

      applyResolvedDocumentTitle(title);
      setMetaDescription(metaDescriptionForPath(path));
    } catch {
      // Ignore — titles are non-critical.
    }
  }, [location.pathname, selectedArtisan?.displayName, selectedArtisan?.city]);
}

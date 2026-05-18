import { useLayoutEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { HelpCenter } from '../help/HelpCenter';
import { helpTopics } from '../help/helpTopics';
import type { HelpBackState } from '../lib/helpNavigation';
import { buildAppPath } from '../lib/appPaths';

const HELP_TOPIC_IDS = new Set(helpTopics.map((topic) => topic.id));

export type HelpLocationState = HelpBackState;

function normalizeTopicSlug(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') return null;
  try {
    const id = decodeURIComponent(raw);
    return HELP_TOPIC_IDS.has(id) ? id : null;
  } catch {
    return null;
  }
}

export default function HelpPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const topicSlug = params.topicId;
  const activeTopicId = useMemo(() => normalizeTopicSlug(topicSlug), [topicSlug]);

  useLayoutEffect(() => {
    if (!topicSlug) return;
    if (activeTopicId !== null) return;
    navigate('/help', { replace: true, state: location.state });
  }, [topicSlug, activeTopicId, navigate, location.state]);

  const helpBack = (location.state as HelpLocationState | null)?.helpBack;

  return (
    <HelpCenter
      activeTopicId={activeTopicId}
      onOpenTopic={(topicId) => {
        if (topicId === null) {
          navigate('/help', { state: location.state });
          return;
        }
        navigate(buildAppPath({ view: 'help', helpTopicId: topicId }), { state: location.state });
      }}
      onBack={() => {
        if (helpBack && helpBack.startsWith('/') && !helpBack.startsWith('//')) {
          navigate(helpBack);
          return;
        }
        navigate('/');
      }}
    />
  );
}

import { useState } from 'react';
import { HelpCenter } from '../help/HelpCenter';
import { useNavigate } from 'react-router-dom';

export default function HelpPage() {
  const navigate = useNavigate();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

  return (
    <HelpCenter
      activeTopicId={activeTopicId}
      onOpenTopic={setActiveTopicId}
      onBack={() => navigate(-1)}
    />
  );
}

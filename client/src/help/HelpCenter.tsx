import { helpTopics } from './helpTopics';

export function HelpCenter({
  activeTopicId,
  onOpenTopic,
  onBack,
}: {
  activeTopicId: string | null;
  onOpenTopic: (topicId: string | null) => void;
  onBack: () => void;
}) {
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId);

  return (
    <main className="help-page">
      <section className="help-panel">
        <button className="back-button" onClick={activeTopic ? () => onOpenTopic(null) : onBack}>
          Back
        </button>

        {!activeTopic && (
          <>
            <p className="eyebrow">Bundo help center</p>
            <h1>How can we help you?</h1>
            <div className="help-highlight">
              <strong>Payments, disputes, cancellations, and reviews — how Bundo keeps the marketplace fair.</strong>
              <p>
                Browse these guides to understand how we protect customers, artisans, and every transaction on
                Bundo.
              </p>
            </div>
            <div className="help-topic-list">
              {helpTopics.map((topic) => (
                <button key={topic.id} className="help-topic-row" onClick={() => onOpenTopic(topic.id)}>
                  <span>{topic.icon}</span>
                  <strong>{topic.title}</strong>
                  <em>&gt;</em>
                </button>
              ))}
            </div>
          </>
        )}

        {activeTopic && (
          <>
            <p className="eyebrow">Help topic</p>
            <h1>{activeTopic.title}</h1>
            <div className="help-section-list">
              {activeTopic.sections.map((section) => (
                <section className="help-section" key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.questions.map(([question, answer]) => (
                    <details key={question} className="help-question">
                      <summary>{question}</summary>
                      <p>{answer}</p>
                    </details>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
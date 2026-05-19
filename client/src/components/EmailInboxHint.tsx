export function EmailInboxHint({ email }: { email?: string }) {
  return (
    <div className="auth-email-inbox-hint" role="note">
      <strong>Don&apos;t see the email?</strong>
      <p>
        Check your <strong>spam</strong> or <strong>junk</strong> folder
        {email ? (
          <>
            {' '}
            for messages to <strong>{email}</strong>
          </>
        ) : null}
        . If you find it there, mark it as <strong>Not spam</strong> so future Bundo emails reach your inbox.
      </p>
      <p className="auth-email-inbox-hint-secondary">
        Gmail and Outlook users: also look in <strong>Promotions</strong>, <strong>Updates</strong>, or <strong>Other</strong>.
      </p>
    </div>
  );
}

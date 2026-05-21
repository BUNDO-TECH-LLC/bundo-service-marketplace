import { markArtisanApplicant } from '../../lib/artisanApplication';
import type { ApiUser } from '../../types';

export function BecomeArtisanButton({
  me,
  busy,
  onStart,
}: {
  me: ApiUser;
  busy?: boolean;
  onStart: () => void;
}) {
  if (me.role === 'ARTISAN' || me.role === 'ADMIN') {
    return null;
  }

  return (
    <button
      type="button"
      className="secondary-button become-artisan-button"
      disabled={busy}
      onClick={() => {
        markArtisanApplicant();
        onStart();
      }}
    >
      Become an artisan
    </button>
  );
}

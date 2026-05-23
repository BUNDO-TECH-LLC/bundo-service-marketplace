import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../ui/AppIcon';

type AccountKind = 'CUSTOMER' | 'ARTISAN';

type SignupRolePickerProps = {
  selectedRole: AccountKind | null;
  onSelectRole: (role: AccountKind) => void;
  onContinue: () => void;
  error?: string;
};

function CustomerIcon() {
  return <AppIcon icon="solar:user-rounded-linear" className="h-5 w-5 text-[var(--color-ink-soft)]" />;
}

function ArtisanIcon() {
  return <AppIcon icon="solar:case-minimalistic-linear" className="h-5 w-5 text-[var(--color-ink-soft)]" />;
}

function RoleCard({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`grid min-h-[124px] gap-6 rounded-xl border px-3 py-4 text-left transition ${
        active
          ? 'border-[var(--color-accent-bright)] bg-[var(--color-accent-wash)] shadow-[0_0_0_1px_var(--color-accent-bright)]'
          : 'border-[var(--color-border)] bg-[var(--color-white)] hover:border-[var(--color-accent-bright)]'
      }`}
      type="button"
      onClick={onClick}
    >
      <span>{icon}</span>
      <span className="text-[15px] font-semibold text-[var(--color-ink-soft)]">{label}</span>
    </button>
  );
}

export function SignupRolePicker({
  selectedRole,
  onSelectRole,
  onContinue,
  error,
}: SignupRolePickerProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 text-center">
        <h3 className="m-0 text-lg font-medium text-[var(--color-ink-soft)]">Join as</h3>
        <div className="grid grid-cols-2 gap-4">
          <RoleCard
            label="Customer"
            icon={<CustomerIcon />}
            active={selectedRole === 'CUSTOMER'}
            onClick={() => onSelectRole('CUSTOMER')}
          />
          <RoleCard
            label="Artisan"
            icon={<ArtisanIcon />}
            active={selectedRole === 'ARTISAN'}
            onClick={() => onSelectRole('ARTISAN')}
          />
        </div>
      </div>

      {error ? (
        <p className="m-0 rounded-md bg-[var(--color-danger-wash)] p-3 text-sm font-bold text-[var(--color-danger-dark)]">
          {error}
        </p>
      ) : null}

      <button
        className="justify-self-center rounded-xl bg-[var(--color-accent-button)] px-6 py-3 text-sm font-bold text-[var(--color-white)] hover:bg-[var(--color-primary-hover)]"
        type="button"
        onClick={onContinue}
      >
        Create account
      </button>

      <p className="m-0 text-center text-sm text-[var(--color-text-sub)]">
        Already have an account?{' '}
        <Link className="font-bold text-[var(--color-accent-link)] no-underline" to="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}

import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { resolveApiSession } from '../../../lib/authSession';
import {
  buildDaySchedules,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  fetchMyAvailabilitySlots,
  formatTime12h,
  hydrateScheduleFromSlots,
  isValidTimeRange,
  ONBOARDING_WEEKDAYS,
  parseTime12h,
  syncAvailabilitySlots,
  type TimeRange,
  WEEKDAY_DAY_NUMBERS,
} from '../../../lib/availabilitySlots';
import { formErrorClassName } from '../../../lib/formStyles';
import { appRoutes } from '../../../routes/paths';
import { OnboardingNavFooter } from './OnboardingNavFooter';
import { isDevOnboardingPreview } from './onboardingPreview';

export function AvailabilityStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const devPreview = isDevOnboardingPreview(location.pathname);
  const dashboardPath = devPreview ? appRoutes.devArtisanDashboard : appRoutes.artisanDashboard;

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [devLocalMode, setDevLocalMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([...WEEKDAY_DAY_NUMBERS]);
  const [sameHoursForAllDays, setSameHoursForAllDays] = useState(true);
  const [sharedHours, setSharedHours] = useState<TimeRange>({
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  });
  const [perDayHours, setPerDayHours] = useState<Record<number, TimeRange>>({});
  const [verificationAccepted, setVerificationAccepted] = useState(false);

  const selectedDaySet = useMemo(() => new Set(selectedDays), [selectedDays]);

  const sortedSelectedDays = useMemo(
    () =>
      ONBOARDING_WEEKDAYS.map((day) => day.dayOfWeek).filter((dayOfWeek) =>
        selectedDaySet.has(dayOfWeek)
      ),
    [selectedDaySet]
  );

  useEffect(() => {
    if (devPreview && (!auth || !auth.currentUser)) {
      setDevLocalMode(true);
      setLoading(false);
      return undefined;
    }

    if (!auth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (devPreview) {
          setDevLocalMode(true);
        }

        setToken('');
        setLoading(false);
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setDevLocalMode(false);

        const slots = await fetchMyAvailabilitySlots(session.token);
        const hydrated = hydrateScheduleFromSlots(slots);

        setSelectedDays(hydrated.selectedDays);
        setSameHoursForAllDays(hydrated.sameHoursForAllDays);
        setSharedHours(hydrated.sharedHours);
        setPerDayHours(hydrated.perDayHours);
      } catch {
        if (devPreview) {
          setDevLocalMode(true);
        } else {
          setFormError('Sign in again to continue.');
        }
      } finally {
        setLoading(false);
      }
    });
  }, [devPreview]);

  function toggleDay(dayOfWeek: number) {
    setSelectedDays((current) => {
      if (current.includes(dayOfWeek)) {
        setPerDayHours((hours) => {
          const next = { ...hours };
          delete next[dayOfWeek];
          return next;
        });
        return current.filter((day) => day !== dayOfWeek);
      }

      setPerDayHours((hours) => ({
        ...hours,
        [dayOfWeek]: hours[dayOfWeek] ?? { ...sharedHours },
      }));

      return [...current, dayOfWeek].sort((a, b) => a - b);
    });
  }

  function selectWeekdays() {
    setSelectedDays([...WEEKDAY_DAY_NUMBERS]);
    setPerDayHours((hours) => {
      const next = { ...hours };

      for (const dayOfWeek of WEEKDAY_DAY_NUMBERS) {
        if (!next[dayOfWeek]) {
          next[dayOfWeek] = { ...sharedHours };
        }
      }

      return next;
    });
  }

  function handleSameHoursToggle(nextValue: boolean) {
    setSameHoursForAllDays(nextValue);

    if (!nextValue) {
      setPerDayHours((hours) => {
        const next = { ...hours };

        for (const dayOfWeek of selectedDays) {
          if (!next[dayOfWeek]) {
            next[dayOfWeek] = { ...sharedHours };
          }
        }

        return next;
      });
    }
  }

  function updateSharedHours(patch: Partial<TimeRange>) {
    setSharedHours((current) => ({ ...current, ...patch }));
  }

  function updatePerDayHours(dayOfWeek: number, patch: Partial<TimeRange>) {
    setPerDayHours((current) => ({
      ...current,
      [dayOfWeek]: {
        ...(current[dayOfWeek] ?? sharedHours),
        ...patch,
      },
    }));
  }

  function validateSchedules() {
    if (selectedDays.length === 0) {
      return 'Select at least one day you are available.';
    }

    if (!verificationAccepted) {
      return 'Confirm that you understand the verification review process.';
    }

    const schedules = buildDaySchedules(
      selectedDays,
      sameHoursForAllDays,
      sharedHours,
      perDayHours
    );

    for (const schedule of schedules) {
      if (!isValidTimeRange(schedule.startTime, schedule.endTime)) {
        const dayName =
          ONBOARDING_WEEKDAYS.find((day) => day.dayOfWeek === schedule.dayOfWeek)?.fullName ??
          'Selected day';
        return `${dayName}: end time must be after start time.`;
      }
    }

    return null;
  }

  async function handleSubmit() {
    setFormError('');

    const validationError = validateSchedules();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (devLocalMode) {
      navigate(dashboardPath);
      return;
    }

    if (!token) {
      setFormError('Sign in again to continue.');
      return;
    }

    setSubmitting(true);

    try {
      const schedules = buildDaySchedules(
        selectedDays,
        sameHoursForAllDays,
        sharedHours,
        perDayHours
      );

      await syncAvailabilitySlots(token, schedules);
      navigate(dashboardPath);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save your availability.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    navigate(dashboardPath);
  }

  const busy = submitting;

  return (
    <>
      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
        <AvailabilityHeader />

        {loading ? (
          <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading your availability…</p>
        ) : (
          <div className="mt-6 grid gap-6">
            <DaysSelector
              selectedDaySet={selectedDaySet}
              onToggleDay={toggleDay}
              onSelectWeekdays={selectWeekdays}
            />

            {sameHoursForAllDays ? (
              <TimeRangeFields
                title="Available Hours"
                description="Set the window during which customers can book you on your available days."
                startTime={sharedHours.startTime}
                endTime={sharedHours.endTime}
                disabled={busy}
                onStartChange={(startTime) => updateSharedHours({ startTime })}
                onEndChange={(endTime) => updateSharedHours({ endTime })}
              />
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <h3 className="m-0 text-base font-semibold text-[var(--color-ink)]">
                    Available Hours
                  </h3>
                  <p className="m-0 text-sm text-[var(--color-text-muted)]">
                    Set the window during which customers can book you on your available days.
                  </p>
                </div>

                {sortedSelectedDays.length === 0 ? (
                  <p className="m-0 text-sm text-[var(--color-text-muted)]">
                    Select at least one day to set hours.
                  </p>
                ) : (
                  sortedSelectedDays.map((dayOfWeek) => {
                    const dayMeta = ONBOARDING_WEEKDAYS.find((day) => day.dayOfWeek === dayOfWeek);
                    const hours = perDayHours[dayOfWeek] ?? sharedHours;

                    return (
                      <TimeRangeFields
                        key={dayOfWeek}
                        title={dayMeta?.fullName ?? 'Day'}
                        startTime={hours.startTime}
                        endTime={hours.endTime}
                        disabled={busy}
                        onStartChange={(startTime) => updatePerDayHours(dayOfWeek, { startTime })}
                        onEndChange={(endTime) => updatePerDayHours(dayOfWeek, { endTime })}
                      />
                    );
                  })
                )}
              </div>
            )}

            <SameHoursToggle
              checked={sameHoursForAllDays}
              disabled={busy}
              onChange={handleSameHoursToggle}
            />

            <VerificationNotice
              checked={verificationAccepted}
              disabled={busy}
              onChange={setVerificationAccepted}
            />

            {formError ? <p className={formErrorClassName}>{formError}</p> : null}
          </div>
        )}
      </section>

      <OnboardingNavFooter
        skipTo={devPreview ? dashboardPath : undefined}
        onSkip={devPreview ? undefined : handleSkip}
        skipLabel="Skip"
        nextLabel={submitting ? 'Submitting…' : 'Submit for verification'}
        nextDisabled={busy || loading}
        nextWide
        onNext={() => void handleSubmit()}
      />
    </>
  );
}

function AvailabilityHeader() {
  return (
    <div className="grid gap-1">
      <h2 className="m-0 text-xl font-semibold text-[var(--color-ink)]">When are you available?</h2>
      <p className="m-0 text-sm text-[var(--color-text-muted)]">
        Customers will only be able to book you on days and times you select. You can update this
        anytime from your dashboard.
      </p>
    </div>
  );
}

type DaysSelectorProps = {
  selectedDaySet: Set<number>;
  onToggleDay: (dayOfWeek: number) => void;
  onSelectWeekdays: () => void;
};

function DaysSelector({ selectedDaySet, onToggleDay, onSelectWeekdays }: DaysSelectorProps) {
  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <p className="m-0 text-sm font-semibold text-[var(--color-ink)]">Days available</p>
        <button
          type="button"
          className="m-0 border-0 bg-transparent p-0 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)]"
          onClick={onSelectWeekdays}
        >
          Weekdays
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        {ONBOARDING_WEEKDAYS.map((day) => {
          const selected = selectedDaySet.has(day.dayOfWeek);

          return (
            <button
              key={day.dayOfWeek}
              type="button"
              className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold transition ${
                selected
                  ? 'bg-[var(--color-accent-bright)] text-white'
                  : 'bg-[var(--color-soft)] text-[var(--color-text-muted)]'
              }`}
              onClick={() => onToggleDay(day.dayOfWeek)}
              aria-pressed={selected}
              aria-label={day.fullName}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TimeRangeFieldsProps = {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  disabled?: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
};

function TimeRangeFields({
  title,
  description,
  startTime,
  endTime,
  disabled = false,
  onStartChange,
  onEndChange,
}: TimeRangeFieldsProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="m-0 text-base font-semibold text-[var(--color-ink)]">{title}</h3>
        {description ? (
          <p className="m-0 text-sm text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>

      <div className="flex items-stretch gap-3">
        <TimeField label="From" value={startTime} disabled={disabled} onChange={onStartChange} />
        <span className="self-center text-[var(--color-text-muted)]">—</span>
        <TimeField label="To" value={endTime} disabled={disabled} onChange={onEndChange} />
      </div>
    </div>
  );
}

type TimeFieldProps = {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function TimeField({ label, value, disabled = false, onChange }: TimeFieldProps) {
  const [displayValue, setDisplayValue] = useState(formatTime12h(value));

  useEffect(() => {
    setDisplayValue(formatTime12h(value));
  }, [value]);

  function handleBlur() {
    const parsed = parseTime12h(displayValue);

    if (parsed) {
      onChange(parsed);
      setDisplayValue(formatTime12h(parsed));
      return;
    }

    setDisplayValue(formatTime12h(value));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDisplayValue(event.target.value);
  }

  return (
    <label className="flex min-h-[52px] flex-1 items-center justify-between gap-3 rounded-lg border border-[var(--color-input-border)] bg-white px-4 py-3">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <input
        className="w-[92px] border-0 bg-transparent p-0 text-right text-base font-semibold text-[var(--color-ink)] outline-none"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        inputMode="text"
        aria-label={`${label} time`}
      />
    </label>
  );
}

type SameHoursToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

function SameHoursToggle({ checked, disabled = false, onChange }: SameHoursToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--color-soft)] px-4 py-4">
      <div className="grid gap-1">
        <p className="m-0 text-sm font-semibold text-[var(--color-ink)]">
          Same hours for all selected days
        </p>
        <p className="m-0 text-sm text-[var(--color-text-muted)]">
          Turn off to set different hours per day
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Same hours for all selected days"
        disabled={disabled}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-[var(--color-accent-bright)]' : 'bg-[var(--color-input-border)]'
        } disabled:cursor-not-allowed disabled:opacity-55`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

type VerificationNoticeProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

function VerificationNotice({ checked, disabled = false, onChange }: VerificationNoticeProps) {
  return (
    <label className="flex items-start gap-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
      <input
        className="mt-1 h-4 w-4 accent-[var(--color-accent-bright)]"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Submitting for verification means our team will review your profile before it goes live.
        This usually takes 24–48 hours. You&apos;ll be notified by email once approved.
      </span>
    </label>
  );
}

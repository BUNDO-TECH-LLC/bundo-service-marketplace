export type NotificationPreferences = {
  bookings: boolean;
  messages: boolean;
  marketing: boolean;
};

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  bookings: true,
  messages: true,
  marketing: false,
});

export function parseNotificationPreferences(value: unknown | null | undefined): NotificationPreferences {
  const defaults = defaultNotificationPreferences();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const record = value as Record<string, unknown>;

  return {
    bookings: typeof record.bookings === 'boolean' ? record.bookings : defaults.bookings,
    messages: typeof record.messages === 'boolean' ? record.messages : defaults.messages,
    marketing: typeof record.marketing === 'boolean' ? record.marketing : defaults.marketing,
  };
}

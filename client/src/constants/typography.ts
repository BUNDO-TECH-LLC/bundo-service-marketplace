export const typography = {
  fontFamily: {
    sans:
      '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  fontSize: {
    display: '3.25rem',
    h1: '2.5rem',
    h2: '2.125rem',
    h3: '1.75rem',
    title: '1.375rem',
    bodyLg: '1.125rem',
    body: '1rem',
    bodySm: '0.9375rem',
    caption: '0.875rem',
    overline: '0.75rem',
  },
  lineHeight: {
    display: '1.08',
    h1: '1.1',
    h2: '1.15',
    h3: '1.2',
    title: '1.3',
    bodyLg: '1.75',
    body: '1.6',
    bodySm: '1.55',
    caption: '1.5',
    overline: '1.3',
  },
  letterSpacing: {
    default: '0',
    tight: '-0.02em',
    overline: '0.12em',
    eyebrow: '0.18em',
  },
} as const;

export const typographyCssVariables = {
  '--font-family-sans': typography.fontFamily.sans,
  '--font-weight-regular': typography.fontWeight.regular,
  '--font-weight-medium': typography.fontWeight.medium,
  '--font-weight-semibold': typography.fontWeight.semibold,
  '--font-weight-bold': typography.fontWeight.bold,
  '--font-weight-extrabold': typography.fontWeight.extrabold,
  '--font-weight-black': typography.fontWeight.black,
  '--font-size-display': typography.fontSize.display,
  '--font-size-h1': typography.fontSize.h1,
  '--font-size-h2': typography.fontSize.h2,
  '--font-size-h3': typography.fontSize.h3,
  '--font-size-title': typography.fontSize.title,
  '--font-size-body-lg': typography.fontSize.bodyLg,
  '--font-size-body': typography.fontSize.body,
  '--font-size-body-sm': typography.fontSize.bodySm,
  '--font-size-caption': typography.fontSize.caption,
  '--font-size-overline': typography.fontSize.overline,
  '--line-height-display': typography.lineHeight.display,
  '--line-height-h1': typography.lineHeight.h1,
  '--line-height-h2': typography.lineHeight.h2,
  '--line-height-h3': typography.lineHeight.h3,
  '--line-height-title': typography.lineHeight.title,
  '--line-height-body-lg': typography.lineHeight.bodyLg,
  '--line-height-body': typography.lineHeight.body,
  '--line-height-body-sm': typography.lineHeight.bodySm,
  '--line-height-caption': typography.lineHeight.caption,
  '--line-height-overline': typography.lineHeight.overline,
  '--letter-spacing-default': typography.letterSpacing.default,
  '--letter-spacing-tight': typography.letterSpacing.tight,
  '--letter-spacing-overline': typography.letterSpacing.overline,
  '--letter-spacing-eyebrow': typography.letterSpacing.eyebrow,
} as const;

export function applyTypography(root: HTMLElement = document.documentElement) {
  Object.entries(typographyCssVariables).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });
}

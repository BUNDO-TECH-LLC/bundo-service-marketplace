import { Icon, type IconProps } from '@iconify/react';

type AppIconProps = Omit<IconProps, 'icon'> & {
  icon: string;
  size?: number | string;
  decorative?: boolean;
  label?: string;
};

export function AppIcon({
  icon,
  size = '1em',
  decorative = true,
  label,
  ...props
}: AppIconProps) {
  const accessibilityProps = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': label || icon };

  return <Icon icon={icon} width={size} height={size} {...accessibilityProps} {...props} />;
}

type ProfileAvatarProps = {
  name: string;
  imageUrl?: string | null;
  className?: string;
  textClassName?: string;
};

export function ProfileAvatar({
  name,
  imageUrl,
  className = 'h-10 w-10',
  textClassName = 'text-sm',
}: ProfileAvatarProps) {
  const initial = name.trim().slice(0, 1).toUpperCase() || 'A';
  const sharedClassName = `shrink-0 overflow-hidden rounded-full ${className}`;

  if (imageUrl) {
    return <img className={`${sharedClassName} object-cover`} src={imageUrl} alt={`${name} profile`} />;
  }

  return (
    <span
      className={`grid ${sharedClassName} place-items-center bg-[var(--color-ink)] font-extrabold text-[var(--color-paper)] ${textClassName}`}
      aria-label={`${name} profile`}
    >
      {initial}
    </span>
  );
}

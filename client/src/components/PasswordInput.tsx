import { useId, useState } from 'react';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  id?: string;
  inputClassName?: string;
  wrapClassName?: string;
};

export function PasswordInput({
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  minLength,
  required,
  id,
  inputClassName,
  wrapClassName,
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const wrapClasses = ['password-input-wrap', wrapClassName].filter(Boolean).join(' ');

  return (
    <span className={wrapClasses}>
      <input
        id={inputId}
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
      />
      <PasswordVisibilityToggle visible={visible} onToggle={() => setVisible((current) => !current)} />
    </span>
  );
}

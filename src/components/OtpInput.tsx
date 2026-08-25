'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Déclenché dès que les 6 chiffres sont saisis — évite un clic superflu. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
};

/**
 * Saisie d'un code à usage unique, une case par chiffre.
 *
 * Points d'attention côté expérience :
 *  — `autocomplete="one-time-code"` permet à iOS et Chrome Android de proposer
 *    le code directement depuis la notification du SMS ou de l'email ;
 *  — le collage d'un code complet remplit toutes les cases d'un coup, au lieu
 *    de n'écrire que le premier caractère ;
 *  — Retour arrière sur une case vide recule d'une case, comportement attendu
 *    par tout utilisateur habitué à ce type de champ ;
 *  — le champ reste un seul groupe pour les lecteurs d'écran grâce au
 *    `aria-label` porté par chaque case et au `role="group"` du conteneur.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  label = 'Code de vérification',
}: Props) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    if (value.length === length && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(value);
    }
    if (value.length < length) completedRef.current = false;
  }, [value, length, onComplete]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const setDigit = (index: number, digit: string) => {
    const next = value.padEnd(length, ' ').split('');
    next[index] = digit || ' ';
    onChange(next.join('').replace(/\s+$/, '').replace(/\s/g, ''));
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setDigit(index, '');
      return;
    }

    // Une saisie de plusieurs chiffres (autofill du code par le navigateur)
    // doit remplir la suite des cases plutôt que d'être tronquée.
    if (digits.length > 1) {
      const merged = (value.slice(0, index) + digits).slice(0, length);
      onChange(merged);
      inputsRef.current[Math.min(merged.length, length - 1)]?.focus();
      return;
    }

    const chars = value.split('');
    chars[index] = digits;
    const merged = chars.join('').slice(0, length);
    onChange(merged);

    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault();
      const chars = value.split('');
      chars[index - 1] = '';
      onChange(chars.join('').replace(/\s/g, ''));
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={element => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="\d*"
          maxLength={length}
          value={value[index] ?? ''}
          disabled={disabled}
          aria-label={`Chiffre ${index + 1} sur ${length}`}
          aria-invalid={invalid || undefined}
          onChange={event => handleChange(index, event.target.value)}
          onKeyDown={event => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={event => event.target.select()}
          className={`w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 bg-slate-50 outline-none transition-all duration-150 tabular-nums
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              invalid
                ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                : 'border-slate-200 text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15'
            }`}
        />
      ))}
    </div>
  );
}

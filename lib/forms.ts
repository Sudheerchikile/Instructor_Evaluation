import type React from 'react';

// Put on a <form onKeyDown>: the form can then only be submitted by clicking its submit button.
// Browsers submit a form when Enter is pressed in a single-line field (by "clicking" the submit
// button), and Enter/Space activate a focused submit button, so those keys are blocked here.
// Still allowed: Enter in a <textarea> (new line) and Enter/Space on ordinary type="button" controls.
export function blockKeyboardSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target as HTMLElement;
  const isSubmitButton = target instanceof HTMLButtonElement && target.type === 'submit';
  if (e.key === ' ' && !isSubmitButton) return;           // typing a space in a field is fine
  if (e.key === 'Enter' && target instanceof HTMLTextAreaElement) return;
  if (target instanceof HTMLButtonElement && !isSubmitButton) return;
  e.preventDefault();
}

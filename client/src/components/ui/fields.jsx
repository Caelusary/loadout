import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useId, useState } from 'react';

// The placeholder is a faint example of what to type; it fades out as soon as the field is focused.
const CONTROL =
  'w-full rounded-control border border-edge bg-plate px-3 text-[15px] text-ink placeholder:text-ink-3/80 placeholder:transition-colors transition-colors duration-150 ease-out hover:border-ink-3 focus:border-accent-ink focus:outline-none focus:placeholder:text-transparent aria-invalid:border-bad disabled:opacity-50';

// The required-field asterisk appears only after a field has been checked and is still empty:
// the input is aria-invalid (set on blur or submit) and is still showing its placeholder.
const MISSING_MARK =
  'hidden text-bad group-has-[input:placeholder-shown[aria-invalid=true]]/field:inline group-has-[textarea:placeholder-shown[aria-invalid=true]]/field:inline group-has-[select:invalid[aria-invalid=true]]/field:inline';

function Field({ id, label, hint, error, optional, children }) {
  return (
    <div className="group/field flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
        {optional ? (
          <span className="font-normal text-ink-3"> (optional)</span>
        ) : (
          <span className={MISSING_MARK} aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-bad">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[13px] text-ink-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

// Every text control gets a placeholder (a single space if none is given) so :placeholder-shown can tell it's empty.
export function TextField({ label, hint, error, optional, className = '', placeholder = ' ', ...props }) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        className={`${CONTROL} h-11 ${className}`}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </Field>
  );
}

// A hint, not a rule: the only hard requirement is 8 characters, since complex rules cost sign-ups.
function passwordStrength(value) {
  if (value.length < 8) return { score: 1, label: 'Too short, use at least 8 characters', color: 'bg-bad' };
  const mixed = /[A-Z]/.test(value) && /[a-z]/.test(value) && /[\d\W_]/.test(value);
  if (value.length >= 12 && mixed) return { score: 3, label: 'Strong', color: 'bg-ok' };
  if (value.length >= 12 || mixed) return { score: 2, label: 'Good. Longer or mixed characters make it stronger', color: 'bg-warn' };
  return { score: 1, label: 'Weak. Try a longer passphrase', color: 'bg-bad' };
}

export function PasswordField({ label, hint, error, showStrength = false, placeholder = ' ', onChange, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [strength, setStrength] = useState(null);
  return (
    <Field id={id} label={label} hint={strength ? undefined : hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`${CONTROL} h-11 pr-12`}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...props}
          onChange={(e) => {
            if (showStrength) setStrength(e.target.value ? passwordStrength(e.target.value) : null);
            onChange?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-control text-ink-3 hover:text-ink"
        >
          {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showStrength && strength && !error && (
        <p className="flex items-center gap-2 text-[13px] text-ink-3" aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1 w-6 rounded-full ${i < strength.score ? strength.color : 'bg-seam'}`} />
            ))}
          </span>
          {strength.label}
        </p>
      )}
    </Field>
  );
}

export function TextAreaField({ label, hint, error, optional, rows = 4, placeholder = ' ', ...props }) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        className={`${CONTROL} py-2.5 leading-relaxed`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </Field>
  );
}

export function SelectField({ label, hint, error, optional, options, placeholder, ...props }) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        className={`${CONTROL} h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M2.5 4.5 6 8l3.5-3.5%22 fill=%22none%22 stroke=%22%23877b6b%22 stroke-width=%221.5%22/></svg>')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9 invalid:text-ink-3`}
        // `required` lets :invalid spot the empty choice; forms use noValidate, so the browser never blocks submit.
        required={!optional && placeholder !== undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-2 ${className}`}>
      <input type="checkbox" className="size-4 shrink-0 accent-accent-ink" {...props} />
      {label}
    </label>
  );
}

// Large radio options, used for the payment method.
export function RadioCards({ legend, name, options, value, onChange, error }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 rounded-control border border-edge px-4 py-3 transition-colors duration-150 ease-out has-checked:border-accent-ink has-checked:bg-accent/10 hover:border-ink-3"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-1 accent-accent-ink"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ink">{o.label}</span>
              {o.description && <span className="text-[13px] text-ink-3">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="text-[13px] text-bad">{error}</p>}
    </fieldset>
  );
}

import { CaretDown, Eye, EyeSlash } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';

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
            {' '}
            *
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

// Number fields only take what they can hold: whole numbers take digits, money also takes one decimal point, and
// phone numbers take digits plus + ( ) - and spaces. Anything else typed or pasted is dropped before the form sees it.
const ALLOWED = { numeric: /[^\d]/g, decimal: /[^\d.]/g, tel: /[^\d+()\s-]/g };
function keepAllowed(value, kind) {
  const kept = value.replace(ALLOWED[kind], '');
  if (kind !== 'decimal') return kept;
  const dot = kept.indexOf('.');
  return dot === -1 ? kept : kept.slice(0, dot + 1) + kept.slice(dot + 1).replaceAll('.', '');
}

// Every text control gets a placeholder (a single space if none is given) so :placeholder-shown can tell it's empty.
export function TextField({
  label,
  hint,
  error,
  optional,
  className = '',
  placeholder = ' ',
  onChange,
  ...props
}) {
  const id = useId();
  const kind =
    props.type === 'tel' || props.inputMode === 'tel'
      ? 'tel'
      : ALLOWED[props.inputMode]
        ? props.inputMode
        : null;
  const filtered = kind
    ? (e) => {
        const el = e.target;
        const clean = keepAllowed(el.value, kind);
        if (clean !== el.value) {
          // Keep the caret where it was, minus the characters dropped before it.
          const caret = Math.max(0, (el.selectionStart ?? clean.length) - (el.value.length - clean.length));
          el.value = clean;
          el.setSelectionRange?.(caret, caret);
        }
        onChange?.(e);
      }
    : onChange;
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        className={`${CONTROL} h-11 ${className}`}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
        onChange={filtered}
      />
    </Field>
  );
}

// A hint, not a rule: the only hard requirement is 8 characters, since complex rules cost sign-ups.
function passwordStrength(value) {
  if (value.length < 8) return { score: 1, label: 'Too short, use at least 8 characters', color: 'bg-bad' };
  const mixed = /[A-Z]/.test(value) && /[a-z]/.test(value) && /[\d\W_]/.test(value);
  if (value.length >= 12 && mixed) return { score: 3, label: 'Strong', color: 'bg-ok' };
  if (value.length >= 12 || mixed)
    return { score: 2, label: 'Good. Longer or mixed characters make it stronger', color: 'bg-warn' };
  return { score: 1, label: 'Weak. Try a longer passphrase', color: 'bg-bad' };
}

export function PasswordField({
  label,
  hint,
  error,
  showStrength = false,
  placeholder = ' ',
  onChange,
  ...props
}) {
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
              <span
                key={i}
                className={`h-1 w-6 rounded-full ${i < strength.score ? strength.color : 'bg-seam'}`}
              />
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

// A themed dropdown: a phone's own picker opens in the system's light colours. A hidden native <select> still
// holds the value, so react-hook-form's register() and plain value/onChange both keep working; picking an
// option sets it and fires a real change event.
export function SelectField({ label, hint, error, optional, options, placeholder, ref, ...props }) {
  const id = useId();
  const native = useRef(null);
  const box = useRef(null);
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(props.value ?? props.defaultValue ?? '');
  const [active, setActive] = useState(0);
  const choices = [...(placeholder !== undefined ? [{ value: '', label: placeholder }] : []), ...options];
  const picked = choices.find((o) => String(o.value) === String(current));

  // The form can set the value without an event (reset, defaults), so read it back after every render. It only
  // sets state when the value really changed, so it can't loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (native.current && native.current.value !== String(current)) setCurrent(native.current.value);
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const setRefs = (el) => {
    native.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  const choose = (value) => {
    const el = native.current;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setCurrent(value);
    setOpen(false);
  };
  const openAt = () => {
    setActive(Math.max(0, choices.indexOf(picked)));
    setOpen(true);
  };
  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openAt();
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') return setOpen(false);
    const moves = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity };
    if (e.key in moves) {
      e.preventDefault();
      setActive((i) => Math.min(choices.length - 1, Math.max(0, i + moves[e.key])));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(String(choices[active].value));
    }
  };

  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <div ref={box} className="relative">
        <select
          ref={setRefs}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          // `required` lets :invalid spot the empty choice for the missing-field mark; forms use noValidate.
          required={!optional && placeholder !== undefined}
          aria-invalid={error ? true : undefined}
          {...props}
          onChange={(e) => {
            setCurrent(e.target.value);
            props.onChange?.(e);
          }}
        >
          {choices.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          disabled={props.disabled}
          onClick={() => (open ? setOpen(false) : openAt())}
          onKeyDown={onKeyDown}
          onBlur={props.onBlur && (() => props.onBlur({ target: native.current, type: 'blur' }))}
          className={`${CONTROL} flex h-11 items-center justify-between gap-2 text-left ${picked && picked.value !== '' ? '' : 'text-ink-3'}`}
        >
          <span className="truncate">{picked?.label ?? placeholder ?? ''}</span>
          <CaretDown
            size={12}
            aria-hidden="true"
            className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={id}
            className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-auto rounded-panel border border-seam bg-plate p-1.5 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.45)]"
          >
            {choices.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={String(o.value) === String(current)}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(String(o.value))}
                className={`flex h-10 cursor-pointer items-center rounded-control px-2.5 text-sm ${
                  i === active ? 'bg-raised text-ink' : 'text-ink-2'
                } aria-selected:text-accent-ink ${o.value === '' ? 'text-ink-3' : ''}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-2 ${className}`}>
      <input type="checkbox" className="check size-[18px]" {...props} />
      {label}
    </label>
  );
}

// Large radio options, used for the payment method.
// `stacked` puts one option per row (checkout's payment methods); otherwise two across from tablet width.
export function RadioCards({ legend, name, options, value, onChange, error, stacked = false }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{legend}</legend>
      <div className={`grid gap-2 ${stacked ? '' : 'sm:grid-cols-2'}`}>
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

// A short list of answers as tap targets: one tap to pick, every option visible, nothing to open. For 2–5 short
// choices; RadioCards suits options that need a description, SelectField long lists.
export function ChoiceChips({ legend, name, options, value, onChange, error }) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-10 cursor-pointer items-center rounded-full border border-edge px-3.5 text-[13px] text-ink-2 transition-colors duration-150 ease-out has-checked:border-accent-ink has-checked:bg-accent/10 has-checked:text-ink has-focus-visible:ring-2 has-focus-visible:ring-accent-ink hover:border-ink-3"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="text-[13px] text-bad">{error}</p>}
    </fieldset>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { TextField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { emailField } from '../../lib/schemas.js';
import { AuthShell } from './AuthShell.jsx';

const schema = z.object({ email: emailField });

// Asks for a reset link. The reply is the same whether or not the email has an account, so the page
// can't be used to check who is registered.
export default function ForgotPasswordPage() {
  useTitle('Forgot password');
  const [sentTo, setSentTo] = useState('');
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur', reValidateMode: 'onChange' });

  return (
    <AuthShell
      title="Forgot your password?"
      footer={
        <Link to="/login" className="text-accent-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p className="text-ink">Check your inbox.</p>
          <p>
            If <span className="text-ink">{sentTo}</span> has a Loadout account, we&apos;ve sent it a link to choose a new
            password. The link works once and expires in 30 minutes. Check your spam folder if it doesn&apos;t arrive.
          </p>
          <button type="button" className="self-start text-accent-ink hover:underline" onClick={() => setSentTo('')}>
            Use a different email
          </button>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async ({ email }) => {
            setFormError('');
            try {
              await api('/auth/forgot-password', { method: 'POST', body: { email } });
              setSentTo(email);
            } catch (err) {
              if (!applyServerErrors(err, setError)) setFormError(err.message);
            }
          })}
        >
          <p className="-mt-4 text-sm text-ink-2">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
          <FormError message={formError} />
          <TextField label="Email" type="email" autoComplete="email" placeholder="Enter your email address" error={errors.email?.message} {...register('email')} />
          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

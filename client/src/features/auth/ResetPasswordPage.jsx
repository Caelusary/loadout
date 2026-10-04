import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { PasswordField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { AuthShell } from './AuthShell.jsx';

const schema = z.object({
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

// The page an emailed reset link opens. The token rides in the #fragment, which the browser never
// sends to a server; it's read once and cleared from the address bar.
function takeToken() {
  const token = window.location.hash.slice(1);
  if (token) window.history.replaceState(null, '', window.location.pathname);
  return token;
}

export default function ResetPasswordPage() {
  useTitle('Choose a new password');
  const [token] = useState(takeToken);
  const [expired, setExpired] = useState(!token);
  const [formError, setFormError] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur', reValidateMode: 'onChange' });

  return (
    <AuthShell
      title="Choose a new password"
      footer={
        <Link to="/login" className="text-accent-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      {expired ? (
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p>This link has expired or was already used. Reset links work once, for 30 minutes.</p>
          <Link to="/forgot-password" className="self-start text-accent-ink hover:underline">
            Send a new link
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async ({ password }) => {
            setFormError('');
            try {
              const res = await api('/auth/reset-password', { method: 'POST', body: { token, password } });
              queryClient.clear();
              queryClient.setQueryData(['me'], res.user);
              toast.show('Password changed. Every other device was signed out.');
              navigate('/', { replace: true });
            } catch (err) {
              if (err.code === 'RESET_EXPIRED') setExpired(true);
              else if (!applyServerErrors(err, setError)) setFormError(err.message);
            }
          })}
        >
          <FormError message={formError} />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            placeholder="Create a new password"
            hint="At least 8 characters"
            showStrength
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
            Save and sign in
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

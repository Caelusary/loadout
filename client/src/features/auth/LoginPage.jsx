import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { safeNext } from '../../components/layout/guards.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { PasswordField, TextField } from '../../components/ui/fields.jsx';
import { applyServerErrors } from '../../lib/api.js';
import { emailField } from '../../lib/schemas.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { AuthShell } from './AuthShell.jsx';

const schema = z.object({ email: emailField, password: z.string().min(1, 'Password is required') });

export default function LoginPage() {
  useTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur', reValidateMode: 'onChange' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await login(values);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err.message);
    }
  });

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{' '}
          <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`} className="text-accent-ink hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Email" type="email" autoComplete="email" placeholder="Enter your email address" error={errors.email?.message} {...register('email')} />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Link to="/forgot-password" className="-mt-2 self-end text-[13px] text-accent-ink hover:underline">
          Forgot password?
        </Link>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

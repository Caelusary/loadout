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
import { emailField, nameField } from '../../lib/schemas.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { AuthShell } from './AuthShell.jsx';

// No "confirm password": the show/hide toggle lets people check what they typed, which Baymard finds works better.
const schema = z.object({
  name: nameField,
  email: emailField,
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
});

export default function RegisterPage() {
  useTitle('Create an account');
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur', reValidateMode: 'onChange' });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError('');
    try {
      await createAccount({ name, email, password });
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err.message);
    }
  });

  return (
    <AuthShell
      title="Create an account"
      footer={
        <>
          Already have one?{' '}
          <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`} className="text-accent-ink underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Full name" autoComplete="name" placeholder="Enter your full name" error={errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" autoComplete="email" placeholder="Enter your email address" error={errors.email?.message} {...register('email')} />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="Create a password"
          hint="At least 8 characters"
          showStrength
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
        <p className="text-[13px] text-ink-3">Want to sell? Create an account first, then apply from your profile.</p>
      </form>
    </AuthShell>
  );
}

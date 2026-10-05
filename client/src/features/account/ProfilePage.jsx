import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { AddressFields } from '../../components/AddressFields.jsx';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { Checkbox, PasswordField, TextField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { addressSchema, emailField, emptyAddress, nameField } from '../../lib/schemas.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

// currentPassword is only asked for (and checked by the server) when the email changes.
const profileSchema = z.object({ name: nameField, email: emailField, shippingAddress: addressSchema, currentPassword: z.string().optional() });

// Until someone saves an address, it's optional: left blank (the name line is prefilled, so it doesn't
// count), it isn't sent at all; once any other field is filled, the whole address is checked.
const isBlankAddress = (a) => !a || Object.entries(a).every(([key, value]) => key === 'fullName' || !String(value ?? '').trim());
const firstProfileSchema = profileSchema.extend({
  shippingAddress: z.preprocess((a) => (isBlankAddress(a) ? undefined : a), addressSchema.optional()),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required').min(8, 'New password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
});

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const hasAddress = Boolean(user.shippingAddress?.line1);
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
  } = useForm({
    resolver: zodResolver(hasAddress ? profileSchema : firstProfileSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: user.name,
      email: user.email,
      shippingAddress: { ...emptyAddress, fullName: user.name, ...user.shippingAddress },
      currentPassword: '',
    },
  });
  const emailChanged = useWatch({ control, name: 'email' })?.trim().toLowerCase() !== user.email;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(async ({ currentPassword, ...values }) => {
        setFormError('');
        if (emailChanged && !currentPassword) {
          setError('currentPassword', { message: 'Enter your password to change your email' });
          return;
        }
        try {
          const res = await api('/users/me', { method: 'PATCH', body: emailChanged ? { ...values, currentPassword } : values });
          setUser(res.user);
          reset({ ...values, currentPassword: '' });
          toast.show('Profile saved');
        } catch (err) {
          if (!applyServerErrors(err, setError)) setFormError(err.message);
        }
      })}
    >
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" autoComplete="name" placeholder="Enter your full name" error={errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" autoComplete="email" placeholder="Enter your email address" error={errors.email?.message} {...register('email')} />
      </div>
      {emailChanged && (
        <div className="max-w-md">
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            placeholder="Enter your password"
            hint="Your email is how you sign in, so changing it needs your password."
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
        </div>
      )}
      <h2 className="mt-4 font-medium">Shipping address</h2>
      {!hasAddress && <p className="-mt-3 text-[13px] text-ink-3">Optional for now. You can also add it at checkout.</p>}
      <AddressFields register={register} errors={errors.shippingAddress} prefix="shippingAddress" />
      <div>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema), mode: 'onBlur', reValidateMode: 'onChange' });

  return (
    <form
      noValidate
      className="flex max-w-md flex-col gap-4"
      onSubmit={handleSubmit(async ({ currentPassword, newPassword }) => {
        setFormError('');
        try {
          const res = await api('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword } });
          reset({ currentPassword: '', newPassword: '' });
          setUser(res.user);
          toast.show('Password changed. Other devices were signed out.');
        } catch (err) {
          if (!applyServerErrors(err, setError)) setFormError(err.message);
        }
      })}
    >
      <FormError message={formError} />
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        placeholder="Enter your current password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        placeholder="Create a new password"
        hint="At least 8 characters"
        showStrength
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <div>
        <Button type="submit" variant="secondary" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}

// Closing your own account: it takes your password; unshipped orders are cancelled only once you say
// so, and anything already shipped has to arrive first. Admins ask the owner instead.
function DeleteAccount() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [openOrders, setOpenOrders] = useState(null); // the server's message when unshipped orders need an answer
  const [cancelOrders, setCancelOrders] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword('');
    setOpenOrders(null);
    setCancelOrders(false);
    setError('');
  };
  const confirm = async () => {
    setError('');
    if (!password) return setError('Enter your password.');
    if (openOrders && !cancelOrders) return setError('Tick the box to cancel them, or keep your account for now.');
    setPending(true);
    try {
      await api('/users/me', { method: 'DELETE', body: { password, cancelOrders } });
      await logout();
      toast.show('Your account is deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      if (err.code === 'OPEN_ORDERS') setOpenOrders(err.message);
      else setError(err.fields?.password ?? err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <p className="mb-4 max-w-md text-sm text-ink-2">
        This removes your account, your reviews and your saved cart for good, and unlists any products you sell. Past
        orders stay with the shops that filled them.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete your account?"
        confirmLabel="Delete my account"
        cancelLabel="Keep my account"
        pending={pending}
        onConfirm={confirm}
        onClose={close}
      >
        <div className="flex flex-col gap-4">
          <p>This can&apos;t be undone.</p>
          <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {openOrders && (
            <>
              <p className="text-ink">{openOrders}</p>
              <Checkbox label="Cancel them and return the items to stock" checked={cancelOrders} onChange={(e) => setCancelOrders(e.target.checked)} />
            </>
          )}
          {error && <p className="text-[13px] text-bad">{error}</p>}
        </div>
      </ConfirmDialog>
    </>
  );
}

export default function ProfilePage() {
  useTitle('Profile');
  const { isAdmin } = useAuth();
  return (
    <div className="flex max-w-2xl flex-col gap-14">
      <section>
        <PanelHeader title="Profile" description="Your saved address fills in checkout automatically." />
        <ProfileForm />
      </section>
      <section className="border-t border-seam pt-10">
        <h2 className="wide mb-5 text-lg font-bold">Password</h2>
        <PasswordForm />
      </section>
      {!isAdmin && (
        <section className="border-t border-seam pt-10">
          <h2 className="wide mb-3 text-lg font-bold">Delete account</h2>
          <DeleteAccount />
        </section>
      )}
    </div>
  );
}

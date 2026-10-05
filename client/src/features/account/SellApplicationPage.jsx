import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { TextAreaField, TextField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { REAPPLY_WAIT_MS } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';

const schema = z.object({
  shopName: z.string().trim().min(1, 'Shop name is required').min(3, 'Shop name must be at least 3 characters').max(40, 'Shop name must be at most 40 characters'),
  bio: z.string().trim().max(500, 'Bio must be at most 500 characters'),
});

const STATUS_COPY = {
  pending: {
    title: 'Application under review',
    body: (p) => `You applied as ${p.shopName} on ${formatDate(p.appliedAt)}. An admin will approve or decline it.`,
  },
  approved: {
    title: 'You can sell on Loadout',
    body: (p) => `${p.shopName} is live. List products and manage orders from Seller Center.`,
  },
  suspended: {
    title: 'Your shop is suspended',
    body: () => 'An admin suspended this shop, so its products are unlisted. Contact support if you think this is a mistake.',
  },
  declined: {
    title: 'Your application was declined',
    body: (p, again) => `An admin declined ${p.shopName} on ${formatDate(p.reviewedAt)}. You can apply again on ${formatDate(again)}.`,
  },
};


export default function SellApplicationPage() {
  useTitle('Sell on Loadout');
  const { user, setUser } = useAuth();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur', reValidateMode: 'onChange', defaultValues: { shopName: '', bio: '' } });

  const [now] = useState(() => Date.now());
  const profile = user.sellerProfile;
  const declined = profile?.status === 'suspended' && user.role === 'customer';
  const againAt = declined ? new Date(profile.reviewedAt ?? profile.appliedAt).getTime() + REAPPLY_WAIT_MS : 0;
  const canReapply = declined && againAt <= now;
  if (profile && !canReapply) {
    const copy = STATUS_COPY[declined ? 'declined' : profile.status];
    return (
      <div className="max-w-xl">
        <PanelHeader title={copy.title} />
        <p className="text-[15px] text-ink-2">{copy.body(profile, againAt)}</p>
        {profile.status === 'approved' && (
          <ButtonLink to="/seller" className="mt-6">
            Open Seller Center
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PanelHeader
        title={canReapply ? 'Apply again' : 'Sell on Loadout'}
        description={
          canReapply
            ? 'Your last application was declined. You can send a new one; an admin reviews it again.'
            : 'Open a shop for your keyboards, mouses, audio gear or accessories. An admin reviews every application.'
        }
      />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (values) => {
          setFormError('');
          try {
            const res = await api('/users/me/seller-application', { method: 'POST', body: values });
            setUser(res.user);
          } catch (err) {
            const mapped = applyServerErrors(err, setError, {
              'sellerProfile.shopName': 'shopName',
              'sellerProfile.bio': 'bio',
            });
            if (!mapped) setFormError(err.message);
          }
        })}
      >
        <FormError message={formError} />
        <TextField label="Shop name" placeholder="Enter your shop name" hint="Shown on your storefront and on every product." error={errors.shopName?.message} {...register('shopName')} />
        <TextAreaField label="About your shop" optional rows={4} placeholder="What do you sell, and what makes your shop different?" error={errors.bio?.message} {...register('bio')} />
        <div>
          <Button type="submit" loading={isSubmitting}>
            Send application
          </Button>
        </div>
      </form>
    </div>
  );
}

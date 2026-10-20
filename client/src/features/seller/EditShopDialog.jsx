import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { TextAreaField, TextField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

// The shop's name and bio, edited from its own storefront (where the seller sees how they read). The address of the
// storefront doesn't change with a rename.
export function EditShopDialog({ open, onClose }) {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const profile = user.sellerProfile;
  const [shopName, setShopName] = useState(profile.shopName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    try {
      const { user: next } = await api('/users/me/shop', { method: 'PATCH', body: { shopName, bio } });
      setUser(next);
      queryClient.invalidateQueries({ queryKey: ['shop'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.show('Shop updated');
      setErrors({});
      onClose();
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else toast.error(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Edit shop"
      confirmLabel="Save"
      cancelLabel="Cancel"
      tone="primary"
      pending={pending}
      onConfirm={save}
      onClose={() => {
        setShopName(profile.shopName);
        setBio(profile.bio ?? '');
        setErrors({});
        onClose();
      }}
    >
      <div className="flex flex-col gap-4 pt-1">
        <TextField
          label="Shop name"
          value={shopName}
          maxLength={40}
          error={errors.shopName}
          onChange={(e) => setShopName(e.target.value)}
        />
        <TextAreaField
          label="Bio"
          optional
          rows={4}
          value={bio}
          maxLength={500}
          hint={`${bio.length}/500`}
          error={errors.bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}

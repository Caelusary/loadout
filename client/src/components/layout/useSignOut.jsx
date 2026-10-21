import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { ConfirmDialog } from '../ui/Dialog.jsx';

// Sign out asks first, so a stray tap in a menu doesn't end the session. Render `dialog` somewhere that stays mounted
// after the menu closes; `ask` opens it.
export function useSignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const dialog = (
    <ConfirmDialog
      open={open}
      title="Sign out?"
      confirmLabel="Sign out"
      cancelLabel="Stay signed in"
      tone="primary"
      pending={pending}
      onConfirm={async () => {
        setPending(true);
        await logout();
        setPending(false);
        setOpen(false);
        navigate('/');
      }}
      onClose={() => setOpen(false)}
    >
      <p>Your cart and orders stay saved to your account for when you sign back in.</p>
    </ConfirmDialog>
  );
  return { ask: () => setOpen(true), dialog };
}

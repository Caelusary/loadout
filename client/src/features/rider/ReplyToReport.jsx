import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../providers/ToastProvider.jsx';

// The rider's side of a report, sent once. Used for reports about the rider (on the delivery profile) and for
// "not received" reports (on the order).
export function ReplyToReport({ path, onSent }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const send = useMutation({
    mutationFn: () => api(path, { method: 'POST', body: { text } }),
    onSuccess: () => {
      toast.show('Sent. An admin reads it before deciding.');
      onSent?.();
    },
    onError: (err) => (err.fields?.text ? setError(err.fields.text) : toast.error(err.message)),
  });
  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length < 10) return setError('Tell us what happened in at least 10 characters.');
        setError(null);
        send.mutate();
      }}
    >
      <TextAreaField
        label="Your side"
        rows={3}
        maxLength={500}
        value={text}
        error={error}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" size="sm" className="self-start" loading={send.isPending}>
        Send to an admin
      </Button>
    </form>
  );
}

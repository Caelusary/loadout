import { useMutation } from '@tanstack/react-query';
import { ArrowBendDownRight } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

// The shop's one public answer under a review. The shop writes, edits or removes it; admins who moderate products
// can remove it. One reply, not a thread, so a review never turns into an argument.
export function ShopReply({ review, shopName, isShop, canModerate, onChange }) {
  const toast = useToast();
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const reply = review.reply;
  const url = `/reviews/${review._id}/reply`;

  const save = useMutation({
    mutationFn: () => api(url, { method: 'PUT', body: { body } }),
    onSuccess: () => {
      toast.show(reply ? 'Reply updated' : 'Reply posted');
      setWriting(false);
      onChange();
    },
    onError: (err) => setError(err.fields?.body ?? err.message),
  });
  const remove = useMutation({
    mutationFn: () => api(url, { method: 'DELETE' }),
    onSuccess: () => {
      toast.show('Reply removed');
      onChange();
    },
    onError: (err) => toast.error(err.message),
  });

  if (writing) {
    return (
      <form
        className="ml-4 flex max-w-2xl flex-col gap-2 border-l-2 border-seam pl-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <TextAreaField
          label={reply ? 'Edit your reply' : 'Reply as the shop'}
          rows={3}
          maxLength={500}
          value={body}
          error={error}
          hint="Everyone can see it. You get one reply per review, which you can edit later."
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={save.isPending}>
            {reply ? 'Save reply' : 'Post reply'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWriting(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const start = () => {
    setBody(reply?.body ?? '');
    setError('');
    setWriting(true);
  };

  if (!reply) {
    return isShop ? (
      <Button variant="secondary" size="sm" onClick={start} className="self-start">
        <ArrowBendDownRight size={14} aria-hidden="true" />
        Reply as the shop
      </Button>
    ) : null;
  }

  return (
    // Inset in the review card, so it reads as the shop answering this buyer.
    <div className="flex flex-col gap-1.5 rounded-control border border-seam bg-raised/50 p-3.5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <ArrowBendDownRight size={14} className="text-accent-ink" aria-hidden="true" />
        Reply from {shopName}
        <span className="font-normal text-ink-3">
          · {formatDate(reply.at)}
          {reply.editedAt && ' · edited'}
        </span>
      </p>
      <p className="max-w-[65ch] text-[14px] leading-relaxed text-ink-2">{reply.body}</p>
      {(isShop || canModerate) && (
        <div className="flex gap-4 text-[13px] text-ink-3">
          {isShop && (
            <button type="button" onClick={start} className="hover:text-ink">
              Edit reply
            </button>
          )}
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="hover:text-bad"
          >
            Remove reply
          </button>
        </div>
      )}
    </div>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { Pagination, RatingDisplay, RatingInput } from '../../components/ui/controls.jsx';
import { ErrorState, FormError, Skeleton } from '../../components/ui/feedback.jsx';
import { TextAreaField, TextField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const schema = z.object({
  rating: z.number({ invalid_type_error: 'Choose a rating' }).int().min(1, 'Choose a rating').max(5),
  title: z.string().trim().min(1, 'Title is required').min(3, 'Title must be at least 3 characters').max(80, 'Title must be at most 80 characters'),
  body: z.string().trim().min(1, 'Review is required').min(10, 'Review must be at least 10 characters').max(1000, 'Review must be at most 1000 characters'),
});

function ReviewForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [formError, setFormError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: initial ?? { rating: 0, title: '', body: '' },
  });

  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4 rounded-panel border border-seam p-5"
      onSubmit={handleSubmit(async (values) => {
        setFormError('');
        try {
          await onSubmit(values);
        } catch (err) {
          if (!applyServerErrors(err, setError)) setFormError(err.message);
        }
      })}
    >
      <FormError message={formError} />
      <Controller
        control={control}
        name="rating"
        render={({ field }) => <RatingInput value={field.value} onChange={field.onChange} error={errors.rating?.message} />}
      />
      <TextField label="Title" placeholder="Sum it up in a few words" error={errors.title?.message} {...register('title')} />
      <TextAreaField label="Review" rows={4} placeholder="What did you like or dislike? How do you use it?" error={errors.body?.message} {...register('body')} />
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function ReviewSection({ product }) {
  const { user, isAdmin, can } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const key = ['reviews', product._id, page, user?._id ?? 'guest'];
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api(`/products/${product._id}/reviews?page=${page}`, { signal }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', product._id] });
    queryClient.invalidateQueries({ queryKey: ['product', product.slug] });
  };

  const remove = useMutation({
    mutationFn: (id) => api(`/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null);
      toast.show('Review deleted');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section id="reviews" className="mt-20 scroll-mt-24 border-t border-seam pt-10">
      <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-2">
        <h2 className="wide text-2xl font-bold">Reviews</h2>
        {product.ratingCount > 0 && (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <span className="font-mono text-lg text-ink tabular-nums">{product.ratingAvg.toFixed(1)}</span>
            <RatingDisplay value={product.ratingAvg} /> from {product.ratingCount} buyer{product.ratingCount === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <div className="mb-10">
        {!user ? (
          <p className="text-sm text-ink-2">
            <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="text-accent-ink underline underline-offset-2">
              Sign in
            </Link>{' '}
            to review this product.
          </p>
        ) : data?.canReview ? (
          <ReviewForm
            submitLabel="Post review"
            onSubmit={async (values) => {
              await api(`/products/${product._id}/reviews`, { method: 'POST', body: values });
              toast.show('Thanks, your review is up');
              refresh();
            }}
          />
        ) : (
          data &&
          !data.myReviewId &&
          !isAdmin && <p className="text-sm text-ink-3">Reviews are from buyers whose order was delivered.</p>
        )}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <div className="flex flex-col gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-ink-2">No reviews yet.</p>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-8">
          {data.items.map((r) => {
            const mine = user && r.user?._id === user._id;
            if (editing === r._id) {
              return (
                <li key={r._id}>
                  <ReviewForm
                    initial={{ rating: r.rating, title: r.title, body: r.body }}
                    submitLabel="Save review"
                    onCancel={() => setEditing(null)}
                    onSubmit={async (values) => {
                      await api(`/reviews/${r._id}`, { method: 'PATCH', body: values });
                      setEditing(null);
                      toast.show('Review updated');
                      refresh();
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={r._id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <RatingDisplay value={r.rating} />
                  <h3 className="font-medium text-ink">{r.title}</h3>
                  {r.returned && <Tag>Returned for a refund</Tag>}
                </div>
                <p className="max-w-[65ch] text-[15px] leading-relaxed text-ink-2">{r.body}</p>
                <div className="flex flex-wrap items-center gap-x-4 text-[13px] text-ink-3">
                  <span>
                    {r.user?.name ?? 'Deleted account'}, {formatDate(r.createdAt)}
                  </span>
                  {mine && (
                    <button type="button" onClick={() => setEditing(r._id)} className="text-ink-2 hover:text-ink">
                      Edit
                    </button>
                  )}
                  {/* Admins with the Products area can remove any review; it's logged and the owner can restore it. */}
                  {(mine || can('products')) && (
                    <button type="button" onClick={() => setDeleting(r)} className="text-ink-2 hover:text-bad">
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this review?"
        confirmLabel="Delete review"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(deleting._id)}
        onClose={() => setDeleting(null)}
      >
        {deleting && user && deleting.user?._id !== user._id
          ? `This removes ${deleting.user?.name ?? 'this buyer'}'s review and updates the product rating.`
          : 'Your review will be removed and the product rating updated.'}
      </ConfirmDialog>
    </section>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { RatingInput } from '../../components/ui/controls.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { TextAreaField, TextField } from '../../components/ui/fields.jsx';
import { applyServerErrors } from '../../lib/api.js';
import { PhotoPicker } from './PhotoPicker.jsx';

const schema = z.object({
  rating: z.number({ invalid_type_error: 'Choose a rating' }).int().min(1, 'Choose a rating').max(5),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(80, 'Title must be at most 80 characters'),
  body: z
    .string()
    .trim()
    .min(1, 'Review is required')
    .min(10, 'Review must be at least 10 characters')
    .max(1000, 'Review must be at most 1000 characters'),
});

// Rating, title, text and up to three photos. Used under a product and in the "Rate" dialog on an order.
export function ReviewForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  className = 'max-w-xl rounded-panel border border-seam p-5',
}) {
  const [formError, setFormError] = useState('');
  const [photos, setPhotos] = useState(initial?.images ?? []);
  const [leaving, setLeaving] = useState(false);
  // Photos added in this sitting are only kept if the review is posted; the server deletes the rest after a day.
  const added = photos.filter((url) => !initial?.images?.includes(url)).length;
  const cancel = () => (added ? setLeaving(true) : onCancel());
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
    defaultValues: { rating: initial?.rating ?? 0, title: initial?.title ?? '', body: initial?.body ?? '' },
  });

  return (
    <form
      noValidate
      className={`flex flex-col gap-4 ${className}`}
      onSubmit={handleSubmit(async (values) => {
        setFormError('');
        try {
          await onSubmit({ ...values, images: photos });
        } catch (err) {
          if (!applyServerErrors(err, setError)) setFormError(err.message);
        }
      })}
    >
      <FormError message={formError} />
      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <RatingInput value={field.value} onChange={field.onChange} error={errors.rating?.message} />
        )}
      />
      <TextField
        label="Title"
        placeholder="Sum it up in a few words"
        error={errors.title?.message}
        {...register('title')}
      />
      <TextAreaField
        label="Review"
        rows={4}
        placeholder="What did you like or dislike? How do you use it?"
        error={errors.body?.message}
        {...register('body')}
      />
      <div className="flex flex-col gap-1.5">
        <PhotoPicker value={photos} onChange={setPhotos} />
        {added > 0 && (
          <p className="text-[12px] text-ink-3">
            New photos are deleted if you don&apos;t post this within a day.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
        {onCancel && !leaving && (
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>
      {leaving && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-panel border border-warn/50 bg-warn/5 p-4 text-sm"
        >
          <p className="text-ink-2">
            <span className="font-medium text-ink">Leave without posting?</span> The{' '}
            {added === 1 ? 'photo' : `${added} photos`} you added will be deleted.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setLeaving(false)}>
              Keep editing
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Leave and delete {added === 1 ? 'it' : 'them'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

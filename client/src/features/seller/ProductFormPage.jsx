import { zodResolver } from '@hookform/resolvers/zod';
import { Cube, UploadSimple } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { PageSpinner } from '../../components/layout/guards.jsx';
import { NotFound } from '../../components/layout/NotFound.jsx';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, FormError } from '../../components/ui/feedback.jsx';
import { Checkbox, SelectField, TextAreaField, TextField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors, assetUrl } from '../../lib/api.js';
import { CutoutReview } from './CutoutReview.jsx';
import {
  CATEGORIES,
  CATEGORY_SINGULAR,
  CONNECTIVITY,
  CONNECTIVITY_LABELS,
  LAYOUT_LABELS,
  LAYOUTS,
  RESOLUTION_LABELS,
  RESOLUTIONS,
  SPEC_FIELDS,
  SWITCH_LABELS,
  SWITCH_TYPES,
} from '../../lib/constants.js';
import { centsToPesoInput, parsePesos, SPEC_NAMES } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useMyProducts } from './SellerProducts.jsx';

const blankToUndefined = (v) => (v === '' || v === null ? undefined : v);
const optionalEnum = (values) => z.preprocess(blankToUndefined, z.enum(values).optional());
const optionalNumber = (label, min, max, { integer = true } = {}) => {
  let n = z.number({ invalid_type_error: `${label} must be a number` });
  if (integer) n = n.int(`${label} must be a whole number`);
  return z.preprocess(
    (v) => (blankToUndefined(v) === undefined ? undefined : Number(v)),
    n.min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).optional(),
  );
};

const pesoField = (label) =>
  z.string().min(1, `${label} is required`).refine((v) => !Number.isNaN(parsePesos(v)), 'Enter a price like 4850 or 4850.50');

// Mirrors server/src/models/Product.js. `price` is the regular price; on sale, customers pay
// `salePrice` and the regular one shows struck through (sent as priceCents + compareAtCents).
const schema = z
  .object({
  name: z.string().trim().min(1, 'Product name is required').min(3, 'Product name must be at least 3 characters').max(120, 'Product name must be at most 120 characters'),
  brand: z.string().trim().min(1, 'Brand is required').min(2, 'Brand must be at least 2 characters').max(40, 'Brand must be at most 40 characters'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters'),
  price: pesoField('Price'),
  onSale: z.boolean(),
  salePrice: z.string(),
  stock: z.preprocess(
    (v) => (v === '' ? undefined : Number(v)),
    z.number({ required_error: 'Stock is required', invalid_type_error: 'Stock must be a number' }).int('Stock must be a whole number').min(0, 'Stock cannot be negative'),
  ),
  specs: z.object({
    connectivity: optionalEnum(CONNECTIVITY),
    switchType: optionalEnum(SWITCH_TYPES),
    layout: optionalEnum(LAYOUTS),
    resolution: optionalEnum(RESOLUTIONS),
    pollingRateHz: optionalNumber('Polling rate', 125, 8000),
    dpiMax: optionalNumber('Max DPI', 100, 50000),
    weightGrams: optionalNumber('Weight', 1, 5000, { integer: false }),
    batteryMah: optionalNumber('Battery', 0, 100000),
    fps: optionalNumber('Frame rate', 15, 120),
    sensor: z.preprocess(blankToUndefined, z.string().trim().max(40, 'Sensor must be at most 40 characters').optional()),
  }),
  images: z
    .array(z.object({ url: z.string(), publicId: z.string().optional(), alt: z.string().trim().min(1, 'Describe the image').max(120, 'Keep it under 120 characters') }))
    .min(1, 'Add at least one image')
    .max(6, 'You can add up to 6 images'),
  modelUrl: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.onSale) return;
    const sale = parsePesos(v.salePrice);
    if (!v.salePrice || Number.isNaN(sale)) {
      ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Enter the sale price, like 3990' });
    } else if (sale >= parsePesos(v.price)) {
      ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'The sale price must be lower than the regular price' });
    }
  });

const ENUM_OPTIONS = {
  connectivity: [CONNECTIVITY, CONNECTIVITY_LABELS],
  switchType: [SWITCH_TYPES, SWITCH_LABELS],
  layout: [LAYOUTS, LAYOUT_LABELS],
  resolution: [RESOLUTIONS, RESOLUTION_LABELS],
};
const UNITS = { pollingRateHz: 'Hz', weightGrams: 'g', batteryMah: 'mAh', fps: 'fps', dpiMax: 'DPI' };

// On a sale, priceCents is what the customer pays (the sale price field) and compareAtCents is the regular price.
const SERVER_FIELD_NAMES = { priceCents: 'price' };
const SALE_FIELD_NAMES = { priceCents: 'salePrice', compareAtCents: 'price' };
const SPEC_PLACEHOLDERS = {
  pollingRateHz: 'e.g. 1000',
  dpiMax: 'e.g. 26000',
  weightGrams: 'e.g. 58',
  batteryMah: 'e.g. 4000',
  fps: 'e.g. 60',
  sensor: 'e.g. PAW3395',
};

function toFormValues(product) {
  if (!product) {
    return { name: '', brand: '', category: '', description: '', price: '', onSale: false, salePrice: '', stock: '', specs: {}, images: [], modelUrl: '' };
  }
  return {
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description ?? '',
    price: centsToPesoInput(product.compareAtCents ?? product.priceCents),
    onSale: Boolean(product.compareAtCents),
    salePrice: product.compareAtCents ? centsToPesoInput(product.priceCents) : '',
    stock: String(product.stock),
    specs: Object.fromEntries(Object.entries(product.specs ?? {}).map(([k, v]) => [k, String(v)])),
    images: product.images.map(({ url, publicId, alt }) => ({ url, publicId, alt })),
    modelUrl: product.modelUrl ?? '',
  };
}

async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  return api('/uploads', { method: 'POST', form });
}

function ProductForm({ product }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const imageInput = useRef(null);
  const modelInput = useRef(null);
  const [uploading, setUploading] = useState('');
  const [reviewing, setReviewing] = useState(null); // photos waiting in the background-removal review
  const [formError, setFormError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({ resolver: zodResolver(schema), mode: 'onBlur', reValidateMode: 'onChange', defaultValues: toFormValues(product) });
  const images = useFieldArray({ control, name: 'images' });
  const [category, name, modelUrl, onSale] = useWatch({ control, name: ['category', 'name', 'modelUrl', 'onSale'] });

  // Picked photos go through the background-removal review first; the chosen versions upload from there.
  const onPick = (files) => {
    const picked = [...files].slice(0, 6 - images.fields.length);
    imageInput.current.value = '';
    if (picked.length) setReviewing(picked);
  };

  const onImages = async (picked) => {
    setReviewing(null);
    setUploading('image');
    // images.fields is this render's snapshot and doesn't grow during the loop, so count appends here.
    const start = images.fields.length;
    try {
      for (const [n, file] of picked.entries()) {
        const stored = await uploadFile(file);
        images.append({ ...stored, alt: name ? `${name}, photo ${start + n + 1}` : '' });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading('');
    }
  };

  const onModel = async (file) => {
    if (!file) return;
    setUploading('model');
    try {
      const stored = await uploadFile(file);
      setValue('modelUrl', stored.url, { shouldDirty: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading('');
      modelInput.current.value = '';
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    const fields = SPEC_FIELDS[values.category];
    const body = {
      name: values.name,
      brand: values.brand,
      category: values.category,
      description: values.description,
      // On sale, the customer pays the sale price and the regular price is kept to show struck through.
      priceCents: parsePesos(values.onSale ? values.salePrice : values.price),
      compareAtCents: values.onSale ? parsePesos(values.price) : null,
      // When editing, send stock only if the seller changed it: otherwise saving an unrelated edit would reset
      // stock to its value when the form opened and undo any sales made since.
      ...(!product || dirtyFields.stock ? { stock: values.stock } : {}),
      specs: Object.fromEntries(fields.filter((k) => values.specs[k] !== undefined).map((k) => [k, values.specs[k]])),
      images: values.images,
      modelUrl: values.modelUrl || '',
    };
    try {
      if (product) await api(`/products/${product._id}`, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast.show(product ? 'Product saved' : 'Product added to your shop');
      navigate('/seller/products');
    } catch (err) {
      if (!applyServerErrors(err, setError, values.onSale ? SALE_FIELD_NAMES : SERVER_FIELD_NAMES)) setFormError(err.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-10">
      <FormError message={formError} />
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField label="Product name" placeholder="e.g. Aster 75 Wireless" error={errors.name?.message} {...register('name')} />
        </div>
        <TextField label="Brand" placeholder="e.g. Northpaw" error={errors.brand?.message} {...register('brand')} />
        <SelectField
          label="Category"
          placeholder="Choose a category"
          options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_SINGULAR[c] }))}
          error={errors.category?.message}
          {...register('category')}
        />
        <TextField label="Price (₱)" inputMode="decimal" placeholder="e.g. 4850" error={errors.price?.message} {...register('price')} />
        <TextField label="Stock" inputMode="numeric" placeholder="How many you have" error={errors.stock?.message} {...register('stock')} />
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Checkbox label="Put this product on sale" {...register('onSale')} />
          {onSale && (
            <div className="max-w-xs">
              <TextField
                label="Sale price (₱)"
                inputMode="decimal"
                placeholder="Lower than the price above"
                hint="Shoppers see the regular price struck through and a Sale tag."
                error={errors.salePrice?.message}
                {...register('salePrice')}
              />
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <TextAreaField label="Description" optional rows={5} placeholder="Materials, what comes in the box, who it suits" error={errors.description?.message} {...register('description')} />
        </div>
      </section>

      {category && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-medium">Specs</h2>
            <p className="text-[13px] text-ink-3">Shoppers filter by these, so fill in what you know.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SPEC_FIELDS[category].map((key) =>
              ENUM_OPTIONS[key] ? (
                <SelectField
                  key={key}
                  label={SPEC_NAMES[key]}
                  optional
                  placeholder="Not specified"
                  options={ENUM_OPTIONS[key][0].map((v) => ({ value: v, label: ENUM_OPTIONS[key][1][v] }))}
                  error={errors.specs?.[key]?.message}
                  {...register(`specs.${key}`)}
                />
              ) : (
                <TextField
                  key={key}
                  label={`${SPEC_NAMES[key]}${UNITS[key] ? ` (${UNITS[key]})` : ''}`}
                  optional
                  inputMode={key === 'sensor' ? 'text' : 'numeric'}
                  placeholder={SPEC_PLACEHOLDERS[key]}
                  error={errors.specs?.[key]?.message}
                  {...register(`specs.${key}`)}
                />
              ),
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">Images</h2>
          <p className="text-[13px] text-ink-3">
            JPG, PNG or WebP up to 2 MB. The first image is the main one. Backgrounds are removed for you, and you can keep
            the original instead.
          </p>
        </div>
        {images.fields.length > 0 && (
          <ul className="flex flex-col gap-3">
            {images.fields.map((field, i) => (
              <li key={field.id} className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
                <img src={assetUrl(field.url)} alt="" className="size-[72px] rounded-control bg-plate object-cover" />
                <TextField label={i === 0 ? 'Alt text (main image)' : 'Alt text'} error={errors.images?.[i]?.alt?.message} {...register(`images.${i}.alt`)} />
                <div className="col-span-2 flex gap-1 sm:col-span-1 sm:pt-6">
                  {i > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => images.move(i, 0)}>
                      Make main
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => images.remove(i)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {errors.images?.message && <p className="text-[13px] text-bad">{errors.images.message}</p>}
        {errors.images?.root?.message && <p className="text-[13px] text-bad">{errors.images.root.message}</p>}
        <div>
          <input
            ref={imageInput}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            className="sr-only"
            id="image-upload"
            onChange={(e) => onPick(e.target.files)}
          />
          {reviewing && <CutoutReview files={reviewing} onDone={onImages} onCancel={() => setReviewing(null)} />}
          {!reviewing && (
            <Button
              variant="secondary"
              onClick={() => imageInput.current.click()}
              loading={uploading === 'image'}
              disabled={images.fields.length >= 6 || Boolean(uploading)}
            >
              <UploadSimple size={16} /> Upload images
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">3D model</h2>
          <p className="text-[13px] text-ink-3">
            Optional .glb file up to 8 MB. Without one, the shop shows a generated model of the product.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {modelUrl ? (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Cube size={18} className="text-accent-ink" /> Model uploaded
            </p>
          ) : (
            <p className="text-sm text-ink-3">No model uploaded</p>
          )}
          <input ref={modelInput} type="file" accept=".glb" className="sr-only" onChange={(e) => onModel(e.target.files[0])} />
          <Button variant="secondary" size="sm" onClick={() => modelInput.current.click()} loading={uploading === 'model'} disabled={Boolean(uploading)}>
            {modelUrl ? 'Replace model' : 'Upload .glb'}
          </Button>
          {modelUrl && (
            <Button variant="ghost" size="sm" onClick={() => setValue('modelUrl', '', { shouldDirty: true })}>
              Remove
            </Button>
          )}
        </div>
      </section>

      <div className="flex gap-2 border-t border-seam pt-6">
        <Button type="submit" size="lg" loading={isSubmitting} disabled={Boolean(uploading) || Boolean(reviewing)}>
          {product ? 'Save product' : 'Add product'}
        </Button>
        <Link to="/seller/products" className="inline-flex h-12 items-center px-4 text-sm text-ink-2 hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  useTitle(id ? 'Edit product' : 'Add product');
  const { data, isPending, isError, error, refetch } = useMyProducts();

  if (!id) {
    return (
      <>
        <PanelHeader title="Add product" />
        <ProductForm />
      </>
    );
  }
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (isPending) return <PageSpinner />;
  const product = data.find((p) => p._id === id);
  if (!product) return <NotFound />;
  return (
    <>
      <PanelHeader title="Edit product" description={product.name} />
      <ProductForm key={product._id} product={product} />
    </>
  );
}

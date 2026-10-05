import { Link } from 'react-router';
import { Price, SwitchChip } from '../../components/ui/chips.jsx';
import { RatingDisplay } from '../../components/ui/controls.jsx';
import { Skeleton } from '../../components/ui/feedback.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { formatSpec } from '../../lib/format.js';
import { CompareButton } from '../compare/CompareButton.jsx';
import { WishlistButton } from '../wishlist/WishlistButton.jsx';

// The two specs a shopper scans for first in each category.
const TILE_SPECS = {
  keyboard: ['layout', 'connectivity'],
  mouse: ['weightGrams', 'connectivity'],
  headset: ['connectivity', 'weightGrams'],
  webcam: ['resolution', 'fps'],
  mousepad: ['weightGrams'],
  accessory: ['connectivity'],
};

export function tileSpecs(product) {
  return (TILE_SPECS[product.category] ?? [])
    .filter((key) => product.specs?.[key] !== undefined)
    .map((key) => formatSpec(key, product.specs[key]));
}

export function ProductTile({ product }) {
  const image = product.images?.[0];
  const soldOut = product.stock === 0;
  // The save/compare buttons sit beside the link, not inside it (no buttons inside links). They show on
  // hover or focus with a mouse, always on touch, and stay visible once switched on.
  const action =
    'size-9 rounded-full border border-seam bg-plate/85 backdrop-blur-sm opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-pressed:opacity-100 transition-opacity';
  return (
    <div className="group relative">
      <Link to={`/p/${product.slug}`} className="flex flex-col gap-3 rounded-panel">
        <ProductImage
          src={image?.url}
          alt={image?.alt}
          sizes="(min-width: 1280px) 22vw, (min-width: 640px) 30vw, 46vw"
          className={`aspect-square rounded-panel ${soldOut ? 'opacity-50' : ''}`}
          imgClassName="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-[1.03]"
        />
        <div className="flex flex-col gap-1 px-0.5">
          <p className="text-[12px] text-ink-3">{product.seller?.sellerProfile?.shopName}</p>
          <h3 className="line-clamp-2 text-[15px] leading-snug font-medium text-ink group-hover:text-accent-ink">
            {product.name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
            {product.specs?.switchType && <SwitchChip type={product.specs.switchType} />}
            {tileSpecs(product).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Price cents={product.priceCents} was={product.compareAtCents} className="text-[15px] font-medium text-ink" />
            {soldOut ? (
              <span className="text-[12px] font-medium text-bad">Sold out</span>
            ) : (
              product.ratingCount > 0 && (
                <RatingDisplay value={product.ratingAvg} count={product.ratingCount} size={12} />
              )
            )}
          </div>
        </div>
      </Link>
      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
        <WishlistButton product={product} className={action} />
        <CompareButton product={product} className={action} />
      </div>
    </div>
  );
}

export function ProductGrid({ products, loading, skeletonCount = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
      {loading
        ? Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-square rounded-panel" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))
        : products.map((p) => <ProductTile key={p._id} product={p} />)}
    </div>
  );
}

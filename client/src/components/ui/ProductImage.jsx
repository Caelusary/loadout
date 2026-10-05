import { ImageBroken } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { imageSrcSet, sizedImageUrl } from '../../lib/api.js';

// Product photo on its plate: a shimmer holds the space until the image loads, then it fades in.
// A broken link shows a placeholder icon instead of the browser's broken-image glyph.
// `size` is the most pixels the image needs; pass `sizes` (its CSS width, as for <img sizes>) where the
// layout width varies, and the browser picks from every stored copy instead.
export function ProductImage({ src, alt = '', className = '', imgClassName = '', eager = false, size = 800, sizes, style }) {
  const ref = useRef(null);
  const [state, setState] = useState('loading');

  // A cached image can finish before React attaches onLoad.
  useLayoutEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setState('loaded');
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-plate ${className}`}>
      {state === 'loading' && <div className="absolute inset-0 animate-pulse bg-raised/70" aria-hidden="true" />}
      {state === 'failed' || !src ? (
        <div className="grid size-full place-items-center text-ink-3" role="img" aria-label={alt || 'Image unavailable'}>
          <ImageBroken size={28} />
        </div>
      ) : (
        <img
          ref={ref}
          src={sizedImageUrl(src, size)}
          srcSet={sizes ? imageSrcSet(src) : undefined}
          sizes={sizes}
          alt={alt}
          width={size}
          height={size}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          style={style}
          className={`size-full object-contain transition-opacity duration-300 ease-out ${state === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      )}
    </div>
  );
}

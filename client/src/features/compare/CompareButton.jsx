import { ArrowsLeftRight } from '@phosphor-icons/react';
import { useCompare } from '../../providers/CompareProvider.jsx';

export function CompareButton({ product, className = '', withLabel = false }) {
  const compare = useCompare();
  const on = compare.has(product._id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={withLabel ? undefined : on ? `Remove ${product.name} from comparison` : `Compare ${product.name}`}
      title={on ? 'In comparison' : 'Compare'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        compare.toggle(product);
      }}
      className={`inline-flex items-center justify-center gap-2 transition-[color,transform] duration-150 ease-out active:scale-90 ${
        on ? 'text-accent-ink' : 'text-ink-2 hover:text-ink'
      } ${className}`}
    >
      <ArrowsLeftRight size={withLabel ? 18 : 17} weight={on ? 'bold' : 'regular'} />
      {withLabel && (on ? 'Comparing' : 'Compare')}
    </button>
  );
}

import { useEffect } from 'react';

export function Container({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Loadout` : 'Loadout';
  }, [title]);
}

// Standard page frame: a title row with an optional action, then content.
export function Page({ title, description, action, children, width = 'max-w-[1280px]' }) {
  useTitle(title);
  return (
    <div className={`mx-auto w-full ${width} px-4 pt-10 sm:px-6`}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="wide text-[28px] leading-tight font-bold sm:text-[32px]">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-ink-2">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

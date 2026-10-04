export function AuthShell({ title, children, footer }) {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col px-4 pt-14 pb-8 sm:pt-20">
      <h1 className="wide mb-8 text-[28px] font-bold">{title}</h1>
      {children}
      <p className="mt-8 text-sm text-ink-2">{footer}</p>
    </div>
  );
}

import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="surface-court relative overflow-hidden">
      <div className="stripe-accent pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="eyebrow text-teal">{eyebrow}</p>
        <h1 className="display-title mt-2 text-4xl text-on-dark sm:text-5xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-sm text-on-dark-muted sm:text-base">{children}</div>}
      </div>
    </section>
  );
}

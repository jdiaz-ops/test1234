"use client";

import Link from "next/link";
import { useCart } from "@/components/storefront/cart-context";

export function StoreHeader({
  brandSlug,
  brandName,
  logoUrl,
}: {
  brandSlug: string;
  brandName: string;
  logoUrl: string | null;
}) {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur border-b border-brand-line">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href={`/t/${brandSlug}`} className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
            <img
              src={logoUrl}
              alt={brandName}
              className="w-9 h-9 rounded-full object-cover border border-brand-line"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand-accent-soft flex items-center justify-center font-display font-semibold text-brand-accent">
              {brandName[0]?.toUpperCase()}
            </div>
          )}
          <span className="font-display font-semibold text-brand-ink">
            {brandName}
          </span>
        </Link>

        <Link
          href={`/t/${brandSlug}/carrito`}
          className="relative rounded-full border border-brand-line px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft"
        >
          Carrito
          {count > 0 && (
            <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-mono">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

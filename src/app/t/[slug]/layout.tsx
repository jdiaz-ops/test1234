import { PoweredByBadge } from "@/components/storefront/powered-by-badge";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PoweredByBadge />
    </>
  );
}

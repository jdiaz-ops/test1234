import { isValidMetaPixelId, isValidTiktokPixelId } from "@/lib/ad-pixels";
import { PixelPageViews } from "@/components/storefront/pixel-events";

/// Código base de Meta y TikTok con el Pixel ID de la marca (ver
/// lib/ad-pixels.ts). Va directo en el HTML (como lo indican Meta y
/// TikTok) para que esté listo antes que cualquier evento de la página. Se
/// vuelve a validar el ID acá porque va dentro de un <script>. No carga
/// dentro de un iframe: así la vista previa del editor de Diseño no le
/// suma visitas falsas a la marca.
export function AdPixels({
  metaPixelId,
  tiktokPixelId,
}: {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
}) {
  const meta = isValidMetaPixelId(metaPixelId) ? metaPixelId : null;
  const tiktok = isValidTiktokPixelId(tiktokPixelId) ? tiktokPixelId : null;
  if (!meta && !tiktok) return null;

  return (
    <>
      {meta && (
        <script
          id="mc-meta-pixel"
          dangerouslySetInnerHTML={{
            __html: `(function(){if(window.top!==window.self)return;
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init',${JSON.stringify(meta)});fbq('track','PageView');})();`,
          }}
        />
      )}
      {tiktok && (
        <script
          id="mc-tiktok-pixel"
          dangerouslySetInnerHTML={{
            __html: `(function(){if(window.top!==window.self)return;
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
ttq.load(${JSON.stringify(tiktok)});ttq.page();}(window,document,'ttq');})();`,
          }}
        />
      )}
      <PixelPageViews />
    </>
  );
}

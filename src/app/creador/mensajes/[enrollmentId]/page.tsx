import { auth } from "@/auth";
import { getThread, MessageError } from "@/server/services/message-service";
import { listShipmentsForEnrollment } from "@/server/services/shipment-service";
import { MessageThread } from "@/components/portal/message-thread";
import { ShipmentPanel } from "@/components/portal/shipment-panel";

export default async function CreadorMensajeThreadPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;
  const session = await auth();

  let thread;
  try {
    thread = await getThread(enrollmentId, session!.user.id);
  } catch (err) {
    if (err instanceof MessageError) {
      return <p className="text-sm text-red-600">{err.message}</p>;
    }
    throw err;
  }

  const shipments = await listShipmentsForEnrollment(enrollmentId);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MENSAJES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">{thread.enrollment.offer.brand.companyName}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MessageThread
            enrollmentId={enrollmentId}
            viewerUserId={session!.user.id}
            sendUrl="/api/creador/mensajes"
            messages={thread.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          />
        </div>
        <div>
          <ShipmentPanel
            enrollmentId={enrollmentId}
            role="CREATOR"
            shipments={shipments.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
          />
        </div>
      </div>
    </div>
  );
}

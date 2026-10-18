-- Marcolini no permite envío contraentrega: una tarifa que venía como
-- contraentrega en $0 ya no se muestra como "se paga al recibir" — queda
-- como tarifa sin precio (bloquea el checkout en esa zona hasta que la
-- marca le ponga precio). Los pedidos no guardan nada al respecto.
ALTER TABLE "ShippingZoneRate" RENAME COLUMN "payOnDelivery" TO "pendingPrice";
ALTER TABLE "StoreOrder" DROP COLUMN "shippingPayOnDelivery";

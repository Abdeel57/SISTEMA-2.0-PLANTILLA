-- Membresía de staff (admins extra y vendedores) + código de vendedor.
ALTER TABLE "User" ADD COLUMN "memberOfRiferoId" TEXT;
ALTER TABLE "User" ADD COLUMN "sellerCode" TEXT;

-- Atribución de la venta a un vendedor (nulo = venta directa).
ALTER TABLE "Order" ADD COLUMN "sellerId" TEXT;

-- Índices
CREATE INDEX "User_memberOfRiferoId_idx" ON "User"("memberOfRiferoId");
CREATE UNIQUE INDEX "User_sellerCode_key" ON "User"("sellerCode");
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

-- Llaves foráneas
ALTER TABLE "User" ADD CONSTRAINT "User_memberOfRiferoId_fkey"
  FOREIGN KEY ("memberOfRiferoId") REFERENCES "RiferoProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

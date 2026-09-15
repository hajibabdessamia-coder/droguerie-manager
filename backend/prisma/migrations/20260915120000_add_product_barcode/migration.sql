-- Purely additive: adds one nullable column to "products". Every existing row gets
-- barcode = NULL (SQLite allows multiple NULLs under a UNIQUE index — they don't
-- collide with each other), so no existing product needs a barcode assigned. No
-- other table or column is touched.
-- AlterTable
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

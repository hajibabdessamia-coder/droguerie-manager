-- CreateTable
CREATE TABLE "sale_returns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnNumber" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "subtotal" DECIMAL NOT NULL,
    "discountShare" DECIMAL NOT NULL DEFAULT 0,
    "taxShare" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sale_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_returns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sale_return_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleReturnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    CONSTRAINT "sale_return_items_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sale_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_returns_returnNumber_key" ON "sale_returns"("returnNumber");

-- CreateIndex
CREATE INDEX "sale_returns_saleId_idx" ON "sale_returns"("saleId");

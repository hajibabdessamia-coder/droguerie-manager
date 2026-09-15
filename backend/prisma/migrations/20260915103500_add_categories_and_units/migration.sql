-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Data preservation: seed one category row per existing GROUP_1..GROUP_4 value, named
-- to match exactly what users already see today (frontend lib/product-groups.ts /
-- i18n productGroups.* — "الفئة الأولى".."الفئة الرابعة") so nothing visibly changes
-- right after this migration. Also seed one default unit ("قطعة") so every existing
-- product ends up with a sensible starting value instead of an empty field. Both are
-- ordinary editable rows afterward — rename, reorder or delete them from Settings.
INSERT INTO "categories" ("id", "name", "sortOrder", "createdAt", "updatedAt") VALUES
  ('legacy-group-1', 'الفئة الأولى', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('legacy-group-2', 'الفئة الثانية', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('legacy-group-3', 'الفئة الثالثة', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('legacy-group-4', 'الفئة الرابعة', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "units" ("id", "name", "sortOrder", "createdAt", "updatedAt") VALUES
  ('legacy-default-unit', 'قطعة', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RedefineTables: SQLite has no ALTER TABLE ... DROP COLUMN + ADD FOREIGN KEY in one
-- step, so Prisma rebuilds the table. The SELECT below carries every existing column
-- across unchanged and computes categoryId/unitId for each row from its old "group"
-- value before that column is dropped — no product loses data.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "internalCode" TEXT NOT NULL,
    "categoryId" TEXT,
    "unitId" TEXT,
    "manufacturerId" TEXT,
    "purchasePrice" DECIMAL NOT NULL,
    "retailPrice" DECIMAL NOT NULL,
    "wholesalePrice" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("id", "name", "imageUrl", "internalCode", "categoryId", "unitId", "manufacturerId", "purchasePrice", "retailPrice", "wholesalePrice", "quantity", "minStock", "notes", "isActive", "createdAt", "updatedAt")
SELECT
  "id", "name", "imageUrl", "internalCode",
  CASE "group"
    WHEN 'GROUP_1' THEN 'legacy-group-1'
    WHEN 'GROUP_2' THEN 'legacy-group-2'
    WHEN 'GROUP_3' THEN 'legacy-group-3'
    WHEN 'GROUP_4' THEN 'legacy-group-4'
    ELSE NULL
  END,
  'legacy-default-unit',
  "manufacturerId", "purchasePrice", "retailPrice", "wholesalePrice", "quantity", "minStock", "notes", "isActive", "createdAt", "updatedAt"
FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_internalCode_key" ON "products"("internalCode");
CREATE INDEX "products_name_idx" ON "products"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

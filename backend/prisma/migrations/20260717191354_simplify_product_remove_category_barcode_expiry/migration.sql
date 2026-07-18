/*
  Warnings:

  - You are about to drop the column `barcode` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProductGroup" AS ENUM ('GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4');

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";

-- DropIndex
DROP INDEX "products_barcode_idx";

-- DropIndex
DROP INDEX "products_barcode_key";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "barcode",
DROP COLUMN "categoryId",
DROP COLUMN "expiryDate",
ADD COLUMN     "group" "ProductGroup" NOT NULL DEFAULT 'GROUP_1';

-- DropTable
DROP TABLE "categories";

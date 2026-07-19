// Prisma's SQLite connector does not support schema-level `enum`, so these fields are plain
// String columns in schema.prisma. These constants replace the enum types Prisma used to
// generate from '@prisma/client', keeping the same names and values everywhere they're used.

export const Role = { ADMIN: 'ADMIN', SELLER: 'SELLER' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ProductGroup = {
  GROUP_1: 'GROUP_1',
  GROUP_2: 'GROUP_2',
  GROUP_3: 'GROUP_3',
  GROUP_4: 'GROUP_4',
} as const;
export type ProductGroup = (typeof ProductGroup)[keyof typeof ProductGroup];

export const StockMovementType = { SALE: 'SALE', PURCHASE: 'PURCHASE', ADJUSTMENT: 'ADJUSTMENT' } as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const CustomerType = { WHOLESALE: 'WHOLESALE', RETAIL: 'RETAIL' } as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const InvoiceType = { TICKET: 'TICKET', LEGAL: 'LEGAL' } as const;
export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];

export const PaymentMethod = { CASH: 'CASH', CREDIT: 'CREDIT' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PriceType = { WHOLESALE: 'WHOLESALE', RETAIL: 'RETAIL', CUSTOM: 'CUSTOM' } as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];

export const AuditAction = {
  LOGIN: 'LOGIN',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SALE: 'SALE',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const BackupStatus = { SUCCESS: 'SUCCESS', FAILED: 'FAILED' } as const;
export type BackupStatus = (typeof BackupStatus)[keyof typeof BackupStatus];

export const AlertType = { LOW_STOCK: 'LOW_STOCK', EXPIRY: 'EXPIRY', BACKUP_READY: 'BACKUP_READY' } as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

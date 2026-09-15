export type Role = 'ADMIN' | 'SELLER';
export type CustomerType = 'WHOLESALE' | 'RETAIL';
export type InvoiceType = 'TICKET' | 'LEGAL';
export type PaymentMethod = 'CASH' | 'CREDIT';
export type PriceType = 'WHOLESALE' | 'RETAIL' | 'CUSTOM';

export interface Manufacturer {
  id: string;
  name: string;
}

// فئة ووحدة منتج قابلتان للإنشاء والتسمية والحذف بالكامل من طرف المستخدم — راجع
// إعدادات > الفئات والوحدات. لا تصنيف ثابت مبرمجاً مسبقاً (بديل GROUP_1..GROUP_4 القديم)
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Unit {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  imageUrl?: string | null;
  internalCode: string;
  barcode?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  unitId?: string | null;
  unit?: Unit | null;
  manufacturerId?: string | null;
  manufacturer?: Manufacturer | null;
  purchasePrice: string;
  retailPrice: string;
  wholesalePrice: string;
  quantity: number;
  minStock: number;
  notes?: string | null;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  type: CustomerType;
  balance: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  balance: string;
}

export interface CustomerPayment {
  id: string;
  amount: string;
  note?: string | null;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  amount: string;
  note?: string | null;
  createdAt: string;
}

export interface CustomerSaleSummary {
  id: string;
  invoiceNumber: string;
  total: string;
  createdAt: string;
}

export interface SupplierPurchaseSummary {
  id: string;
  invoiceRef?: string | null;
  total: string;
  date: string;
}

export interface PurchaseItemDetail {
  id: string;
  productId: string;
  quantity: number;
  purchasePrice: string;
  total: string;
  product?: Product;
}

export interface PurchaseListItem {
  id: string;
  invoiceRef?: string | null;
  total: string;
  date: string;
  supplier: Supplier;
}

export interface PurchaseDetail extends PurchaseListItem {
  items: PurchaseItemDetail[];
}

export interface CustomerDetail extends Customer {
  sales: CustomerSaleSummary[];
  payments: CustomerPayment[];
}

export interface SupplierDetail extends Supplier {
  purchases: SupplierPurchaseSummary[];
  payments: SupplierPayment[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface LowStockProduct {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
}

export interface RecentSale {
  id: string;
  invoiceNumber: string;
  total: string;
  customerName: string | null;
  sellerName: string;
  createdAt: string;
}

export interface DashboardSummary {
  todayTransactionsCount: number;
  profitToday: number;
  totalInvoices: number;
  totalProducts: number;
  lowStockCount: number;
  lowStockProducts: LowStockProduct[];
  recentSales: RecentSale[];
}

export interface SaleItemDetail {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  priceType: PriceType;
  total: string;
  product?: Product;
}

export interface SaleDetail {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  customerId?: string | null;
  customer?: Customer | null;
  sellerId: string;
  seller?: { id: string; name: string };
  subtotal: string;
  discount: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  changeDue: string;
  paymentMethod: PaymentMethod;
  items: SaleItemDetail[];
  createdAt: string;
}

export interface StoreSettings {
  id: string;
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  ifNumber?: string | null;
  ice?: string | null;
  rc?: string | null;
  patente?: string | null;
  defaultTaxRate: string;
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ProductStat {
  name: string;
  qty: number;
  revenue: number;
}

export interface ReportSummary {
  period: ReportPeriod;
  periodLabel: string;
  start: string;
  end: string;
  salesTotal: number;
  profitTotal: number;
  invoiceCount: number;
  purchasesValue: number;
  inventoryValue: number;
  topProducts: ProductStat[];
  leastProducts: ProductStat[];
}

export type BackupStatus = 'SUCCESS' | 'FAILED';

export interface Backup {
  id: string;
  filePath: string;
  sizeBytes: number | null;
  status: BackupStatus;
  createdAt: string;
}

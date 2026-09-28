import type { InvoiceLocale } from './pdf.util';

// نصوص أوراق Excel (عناوين + رؤوس أعمدة) وقيم بعض الحقول (طريقة الدفع، نوع الزبون) —
// نفس المصطلحات المستخدمة فعلياً في قاموسَي الواجهة الأمامية (common.roles/paymentMethod
// في ar.ts/fr.ts) حتى يبقى المصطلح موحداً بين الشاشة والتصدير
export const REPORT_LABELS: Record<InvoiceLocale, {
  sales: { sheetTitle: string; invoiceNumber: string; date: string; customer: string; seller: string; subtotal: string; discount: string; tax: string; total: string; returned: string; netTotal: string; profit: string; paymentMethod: string };
  products: { sheetTitle: string; name: string; internalCode: string; manufacturer: string; purchasePrice: string; retailPrice: string; wholesalePrice: string; quantity: string; minStock: string; inventoryValue: string };
  customers: { sheetTitle: string; name: string; phone: string; address: string; type: string; balance: string };
  suppliers: { sheetTitle: string; name: string; phone: string; address: string; balance: string };
  paymentMethod: { CASH: string; CREDIT: string };
  customerType: { WHOLESALE: string; RETAIL: string };
}> = {
  ar: {
    sales: {
      sheetTitle: 'المبيعات', invoiceNumber: 'رقم الفاتورة', date: 'التاريخ', customer: 'الزبون', seller: 'البائع',
      subtotal: 'المجموع الفرعي', discount: 'الخصم', tax: 'الضريبة', total: 'الإجمالي', returned: 'المرتجع', netTotal: 'الصافي بعد الإرجاع', profit: 'الربح', paymentMethod: 'طريقة الدفع',
    },
    products: {
      sheetTitle: 'المنتجات والمخزون', name: 'اسم المنتج', internalCode: 'الكود الداخلي', manufacturer: 'الشركة المصنعة',
      purchasePrice: 'سعر الشراء', retailPrice: 'سعر التقسيط', wholesalePrice: 'سعر الجملة', quantity: 'الكمية',
      minStock: 'الحد الأدنى', inventoryValue: 'قيمة المخزون',
    },
    customers: { sheetTitle: 'الزبائن', name: 'الاسم', phone: 'الهاتف', address: 'العنوان', type: 'النوع', balance: 'الرصيد' },
    suppliers: { sheetTitle: 'الموردون', name: 'الاسم', phone: 'الهاتف', address: 'العنوان', balance: 'الرصيد' },
    paymentMethod: { CASH: 'نقدي', CREDIT: 'على الحساب' },
    customerType: { WHOLESALE: 'جملة', RETAIL: 'تقسيط' },
  },
  fr: {
    sales: {
      sheetTitle: 'Ventes', invoiceNumber: 'N° de facture', date: 'Date', customer: 'Client', seller: 'Vendeur',
      subtotal: 'Sous-total', discount: 'Remise', tax: 'Taxe', total: 'Total', returned: 'Retourné', netTotal: 'Net après retour', profit: 'Bénéfice', paymentMethod: 'Mode de paiement',
    },
    products: {
      sheetTitle: 'Produits et stock', name: 'Nom du produit', internalCode: 'Code interne', manufacturer: 'Fabricant',
      purchasePrice: "Prix d'achat", retailPrice: 'Prix détail', wholesalePrice: 'Prix gros', quantity: 'Quantité',
      minStock: 'Stock minimum', inventoryValue: 'Valeur du stock',
    },
    customers: { sheetTitle: 'Clients', name: 'Nom', phone: 'Téléphone', address: 'Adresse', type: 'Type', balance: 'Solde' },
    suppliers: { sheetTitle: 'Fournisseurs', name: 'Nom', phone: 'Téléphone', address: 'Adresse', balance: 'Solde' },
    paymentMethod: { CASH: 'Espèces', CREDIT: 'À crédit' },
    customerType: { WHOLESALE: 'Gros', RETAIL: 'Détail' },
  },
};

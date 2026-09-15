// القاموس المركزي لكل رسائل الأخطاء التي تصل المستخدم عبر HTTP. الخدمات لا تطرح نص
// جاهزاً بعد الآن، بل رمزاً (code) — راجع common/filters/http-exception.filter.ts الذي
// يترجم الرمز حسب لغة الطلب (ترويسة X-Locale أو ?locale=) قبل إرسال الاستجابة. نفس
// نمط قاموسَي الواجهة الأمامية (frontend/src/i18n/dictionaries)، لكن بمفاتيح مسطّحة
// لأن كل رمز يُستهلك من مكان طرح واحد فقط، لا حاجة لتركيب متداخل هنا.
export type Locale = 'ar' | 'fr';

type Translated = Record<Locale, string>;
type MessageEntry = Translated | ((params: Record<string, string>) => Translated);

export const MESSAGES: Record<string, MessageEntry> = {
  // auth.service.ts
  AUTH_INVALID_CREDENTIALS: { ar: 'بيانات الدخول غير صحيحة', fr: 'Identifiants incorrects' },
  AUTH_ADMIN_REQUIRED: { ar: 'صلاحيات المدير مطلوبة', fr: 'Droits administrateur requis' },
  AUTH_USER_NOT_FOUND: { ar: 'المستخدم غير موجود', fr: 'Utilisateur introuvable' },
  AUTH_CURRENT_PASSWORD_INVALID: { ar: 'كلمة المرور الحالية غير صحيحة', fr: 'Mot de passe actuel incorrect' },
  AUTH_EMAIL_TAKEN: { ar: 'هذا البريد الإلكتروني مستخدم بالفعل', fr: 'Cette adresse e-mail est déjà utilisée' },

  // products.service.ts / sales.service.ts
  PRODUCT_NOT_FOUND: { ar: 'المنتج غير موجود', fr: 'Produit introuvable' },
  PRODUCT_NOT_FOUND_WITH_ID: (p) => ({
    ar: `منتج غير موجود: ${p.productId}`,
    fr: `Produit introuvable : ${p.productId}`,
  }),
  PRODUCT_OUT_OF_STOCK: (p) => ({
    ar: `الكمية غير متوفرة للمنتج: ${p.productName}`,
    fr: `Quantité insuffisante pour le produit : ${p.productName}`,
  }),

  // categories.service.ts / units.service.ts / manufacturers.service.ts
  CATEGORY_NOT_FOUND: { ar: 'الفئة غير موجودة', fr: 'Catégorie introuvable' },
  UNIT_NOT_FOUND: { ar: 'الوحدة غير موجودة', fr: 'Unité introuvable' },
  MANUFACTURER_NOT_FOUND: { ar: 'الشركة المصنعة غير موجودة', fr: 'Fabricant introuvable' },

  // customers.service.ts / suppliers.service.ts
  CUSTOMER_NOT_FOUND: { ar: 'الزبون غير موجود', fr: 'Client introuvable' },
  SUPPLIER_NOT_FOUND: { ar: 'المورد غير موجود', fr: 'Fournisseur introuvable' },

  // purchases.service.ts
  PURCHASE_NOT_FOUND: { ar: 'فاتورة الشراء غير موجودة', fr: "Facture d'achat introuvable" },

  // sales.service.ts
  SALE_NOT_FOUND: { ar: 'الفاتورة غير موجودة', fr: 'Facture introuvable' },
  SALE_CUSTOM_PRICE_REQUIRED: { ar: 'السعر المخصص مطلوب', fr: 'Le prix personnalisé est requis' },
  SALE_CREDIT_REQUIRES_CUSTOMER: {
    ar: 'لا يمكن جعل الفاتورة على الحساب بدون زبون مرتبط بها',
    fr: 'Une facture à crédit doit être associée à un client',
  },
  SALE_OVERRIDE_TOKEN_REQUIRED: {
    ar: 'يتطلب تعديل السعر تفويضاً من المدير',
    fr: 'La modification du prix nécessite une autorisation du gérant',
  },
  SALE_OVERRIDE_TOKEN_INVALID: {
    ar: 'تفويض المدير غير صالح أو منتهي الصلاحية',
    fr: "L'autorisation du gérant est invalide ou expirée",
  },

  // backup.service.ts
  BACKUP_NOT_FOUND: { ar: 'النسخة الاحتياطية غير موجودة', fr: 'Sauvegarde introuvable' },
  BACKUP_FILE_MISSING: {
    ar: 'ملف النسخة الاحتياطية مفقود من القرص',
    fr: 'Le fichier de sauvegarde est introuvable sur le disque',
  },

  // uploads.controller.ts
  UPLOAD_INVALID_IMAGE_FORMAT: {
    ar: 'صيغة الصورة غير مدعومة (jpg, png, webp فقط)',
    fr: "Format d'image non pris en charge (jpg, png, webp uniquement)",
  },
  UPLOAD_FILE_REQUIRED: { ar: 'الملف مطلوب', fr: 'Le fichier est requis' },

  // license/license.service.ts
  LICENSE_DEVICE_ID_FAILED: {
    ar: 'تعذّر تحديد هوية هذا الجهاز',
    fr: "Impossible d'identifier cet appareil",
  },

  // reports/pdf.util.ts + excel.util.ts
  PDF_GENERATION_FAILED: { ar: 'فشل توليد ملف PDF', fr: 'Échec de la génération du PDF' },
  EXCEL_GENERATION_FAILED: { ar: 'فشل توليد ملف Excel', fr: 'Échec de la génération du fichier Excel' },

  // common/filters/prisma-exception.filter.ts
  DB_DUPLICATE_VALUE: (p) => ({
    ar: `القيمة مستخدمة مسبقاً: ${p.target}`,
    fr: `Valeur déjà utilisée : ${p.target}`,
  }),
  DB_RECORD_NOT_FOUND: { ar: 'العنصر غير موجود', fr: 'Élément introuvable' },
  DB_ERROR: { ar: 'خطأ في قاعدة البيانات', fr: 'Erreur de base de données' },

  // class-validator (ValidationPipe) — رسالة عامة تستبدل مصفوفة الأخطاء التفصيلية
  // (إنجليزية افتراضياً، أو تقنية) بدل تسريبها كما هي للمستخدم
  VALIDATION_FAILED: {
    ar: 'بيانات غير صالحة، يرجى التحقق من الحقول المدخلة',
    fr: 'Données invalides, veuillez vérifier les champs saisis',
  },
};

export function translate(code: string, locale: Locale, params?: Record<string, string>): string | undefined {
  const entry = MESSAGES[code];
  if (!entry) return undefined;
  const resolved = typeof entry === 'function' ? entry(params ?? {}) : entry;
  return resolved[locale];
}

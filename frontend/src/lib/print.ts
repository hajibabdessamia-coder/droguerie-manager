import { useEffect, useState } from 'react';

// سطح الجسر الذي يكشفه electron/preload.js. غير موجود عند تشغيل الواجهة في متصفح عادي
// (وضع التطوير) — كل الدوال أدناه تعود للسلوك القديم window.print() في تلك الحالة
export type ReceiptPaper = '58' | '80';
export type PrintKind = 'receipt' | 'document';

export interface PrintSettings {
  receiptPrinter: string;
  receiptPaper: ReceiptPaper;
  documentPrinter: string;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface PrintBridge {
  getPrinters(): Promise<PrinterInfo[]>;
  getSettings(): Promise<PrintSettings>;
  saveSettings(settings: PrintSettings): Promise<PrintSettings>;
  // success=false يعني "لم تُطبع مباشرة" (لا طابعة مُعدّة، أو فشلت) — وليس خطأً بحد ذاته
  print(request: { kind: PrintKind; heightPx?: number }): Promise<{ success: boolean; failureReason?: string }>;
}

declare global {
  interface Window {
    l7ssabPrint?: PrintBridge;
  }
}

export function getPrintBridge(): PrintBridge | null {
  return typeof window !== 'undefined' && window.l7ssabPrint ? window.l7ssabPrint : null;
}

// contentEl: عنصر التذكرة، يُقاس طوله لتحديد طول الورق الحراري عند الطباعة المباشرة
export async function printPage(kind: PrintKind, contentEl?: HTMLElement | null): Promise<void> {
  const bridge = getPrintBridge();
  if (!bridge) {
    window.print();
    return;
  }
  // نافذة الطباعة العادية هي الأصل وشبكة الأمان: تُستعمل عند عدم إعداد طابعة، أو
  // عند فشل الطباعة المباشرة لأي سبب، أو عند أي خطأ في الجسر نفسه
  let printedDirectly = false;
  try {
    printedDirectly = (await bridge.print({ kind, heightPx: contentEl?.offsetHeight })).success;
  } catch {
    printedDirectly = false;
  }
  if (!printedDirectly) window.print();
}

// عرض ورق التذكرة الحرارية المُعدّ على هذا الجهاز؛ 80mm افتراضياً (وأيضاً خارج Electron)
export function useReceiptPaper(): ReceiptPaper {
  const [paper, setPaper] = useState<ReceiptPaper>('80');
  useEffect(() => {
    getPrintBridge()
      ?.getSettings()
      .then((s) => setPaper(s.receiptPaper))
      .catch(() => {});
  }, []);
  return paper;
}

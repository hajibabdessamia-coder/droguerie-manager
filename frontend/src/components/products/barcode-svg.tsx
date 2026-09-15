'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// يرسم باركود EAN-13 كـ SVG داخل المتصفح مباشرة (jsbarcode) — يُستخدم في معاينة نموذج
// المنتج وصفحة طباعة الملصقات. SVG (وليس canvas) لأنه يبقى حاداً عند الطباعة مهما
// كان حجم/دقة الطابعة، خلافاً لصورة نقطية ذات دقة ثابتة
export function BarcodeSvg({ value, height = 50 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'EAN13',
        width: 1.6,
        height,
        displayValue: true,
        fontSize: 13,
        margin: 6,
      });
    } catch {
      // قيمة لا تطابق صيغة EAN13 (مثال: باركود UPC-A أو EAN-8 مُدخَل يدوياً من عبوة
      // خارجية) — jsbarcode يرمي استثناءً بدل رسم شيء خاطئ؛ لا شيء يُعرض هنا حينها
    }
  }, [value, height]);

  return <svg ref={ref} role="img" aria-label={value} />;
}

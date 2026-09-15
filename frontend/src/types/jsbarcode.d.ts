// الحزمة jsbarcode لا تُصدِّر أنواعاً كوحدة ES (تعريفها الأصلي namespace عام غير مرتبط
// بنظام الوحدات)، فهذا إعلان أدنى محلي يكفي لاستخدامها هنا: JsBarcode(element, value, options)
declare module 'jsbarcode' {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    textMargin?: number;
  }

  function JsBarcode(
    element: SVGElement | HTMLCanvasElement | string,
    value: string,
    options?: JsBarcodeOptions,
  ): void;

  export default JsBarcode;
}

// يُستخدم فقط أثناء تشغيل اختبارات e2e لتفادي إطلاق Chromium فعلياً
// (توليد PDF الفعلي مُتحقَّق منه يدوياً في مرحلة التقارير).
module.exports = {
  launch: async () => ({
    newPage: async () => ({
      setContent: async () => {},
      pdf: async () => Buffer.from(''),
    }),
    close: async () => {},
  }),
};

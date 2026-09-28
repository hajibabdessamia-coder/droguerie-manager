const { contextBridge, ipcRenderer } = require('electron');

// جسر ضيّق ومحدَّد بدل كشف ipcRenderer نفسه للواجهة — الواجهة تستطيع فقط ما هو
// مذكور هنا. راجع معالجات print:* في main.js
contextBridge.exposeInMainWorld('l7ssabPrint', {
  getPrinters: () => ipcRenderer.invoke('print:list-printers'),
  getSettings: () => ipcRenderer.invoke('print:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('print:save-settings', settings),
  print: (request) => ipcRenderer.invoke('print:run', request),
});

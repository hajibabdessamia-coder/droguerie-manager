'use client';

import { useState } from 'react';
import { MobileSidebar, Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        <Sidebar />
        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}

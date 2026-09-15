import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  hasHydrated: boolean;
  login: (user: AuthUser, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      hasHydrated: false,
      login: (user, accessToken) => set({ user, accessToken }),
      logout: () => set({ user: null, accessToken: null }),
      updateUser: (user) => set({ user }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      // مُجمَّد عمداً على الاسم القديم: تغيير مفتاح التخزين يُخرج كل المستخدمين
      // الحاليين من جلساتهم بلا فائدة — المفتاح داخلي ولا يظهر في الواجهة
      name: 'pharma-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

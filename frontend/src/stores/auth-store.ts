import { create } from 'zustand';

type User = {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName?: string | null;
  lastName?: string | null;
};

type AuthState = {
  user: User | null;
  csrfToken: string | null;
  setSession: (user: User, csrfToken: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  csrfToken: null,
  setSession: (user, csrfToken) => set({ user, csrfToken }),
  clearSession: () => set({ user: null, csrfToken: null }),
}));

/**
 * authStore — Zustand (§6.3)
 *
 * 인증 상태 관리: 로그인/로그아웃/세션복원/역할
 */
import { create } from 'zustand';
import { signIn, signOut, restoreSession, UserRole } from '../utils/auth';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  idToken: string | null;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  tryRestoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  email: null,
  role: null,
  idToken: null,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await signIn(email, password);
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: result.userId,
        email: result.email,
        role: result.role,
        idToken: result.idToken,
        error: null,
      });
    } catch (err: any) {
      const message =
        err?.message === 'Incorrect username or password.'
          ? '이메일 또는 비밀번호가 올바르지 않습니다'
          : '로그인에 실패했습니다';
      set({ isLoading: false, error: message });
    }
  },

  logout: async () => {
    await signOut();
    set({
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      email: null,
      role: null,
      idToken: null,
      error: null,
    });
  },

  tryRestoreSession: async () => {
    set({ isLoading: true });
    const result = await restoreSession();
    if (result) {
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: result.userId,
        email: result.email,
        role: result.role,
        idToken: result.idToken,
      });
    } else {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

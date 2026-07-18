/**
 * API 클라이언트 — spec-app-ux.md §6.2, spec-b.md §4
 *
 * - axios 인스턴스 1개
 * - baseURL: 실제 배포 API Gateway
 * - 타임아웃 8초
 * - Bearer idToken 자동 첨부
 * - GET만 1회(1초 후) 재시도, POST/PUT 재시도 금지
 * - 401 인터셉터: 1회 토큰 갱신 → 실패 시 로그인 유도
 * - 에러 → 사용자 문구 매핑 (§6.4)
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { refreshIdToken } from '../utils/auth';
import { useAuthStore } from '../stores/authStore';

// ─── API 인스턴스 ───────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: 'https://c5872gzg3b.execute-api.ap-northeast-2.amazonaws.com',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Bearer idToken 자동 첨부 ──────────────────────────────────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const idToken = session.tokens?.idToken?.toString();
    if (idToken && config.headers) {
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch {
    // 토큰 없으면 그냥 진행 (401이 돌아올 것)
  }
  return config;
});

// ─── GET 1회 재시도 (1초 후) ───────────────────────────────────────────
apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config;
  if (!config) return Promise.reject(error);

  // GET만 1회 재시도, POST/PUT 금지
  const isRetryable =
    config.method?.toUpperCase() === 'GET' &&
    !(config as any).__retried &&
    (error.code === 'ECONNABORTED' || !error.response);

  if (isRetryable) {
    (config as any).__retried = true;
    await new Promise<void>((r) => setTimeout(r, 1000));
    return apiClient.request(config);
  }

  return Promise.reject(error);
});

// ─── 401 인터셉터: 1회 토큰 갱신 ───────────────────────────────────────
apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config;
  if (!config || error.response?.status !== 401) return Promise.reject(error);
  if ((config as any).__authRetried) return Promise.reject(error);

  (config as any).__authRetried = true;
  const newToken = await refreshIdToken();

  if (newToken) {
    config.headers.Authorization = `Bearer ${newToken}`;
    return apiClient.request(config);
  }

  // 갱신 실패 → 로그인 유도
  useAuthStore.getState().logout();
  return Promise.reject(error);
});

// ─── 에러 → 사용자 문구 매핑 (§6.4) ────────────────────────────────────
export function getErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return '알 수 없는 오류가 발생했습니다';

  const axiosErr = error as AxiosError;

  // 타임아웃·네트워크
  if (axiosErr.code === 'ECONNABORTED' || !axiosErr.response) {
    return '연결이 원활하지 않습니다';
  }

  const status = axiosErr.response.status;

  switch (status) {
    case 401:
      return '다시 로그인해 주세요';
    case 403:
      return '이 기능의 권한이 없습니다';
    case 409:
      return '다른 관리자가 먼저 처리했습니다';
    default:
      if (status >= 500) return '잠시 후 다시 시도해 주세요';
      return '요청을 처리할 수 없습니다';
  }
}

// ─── API 타입 ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; msg: string };
}

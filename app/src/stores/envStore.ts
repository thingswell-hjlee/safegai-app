/**
 * envStore — Zustand (§6.3)
 *
 * 현장 환경 데이터 상태 관리 뼈대.
 * 상세 구현은 M6 환경 화면 모듈에서.
 */
import { create } from 'zustand';

export interface DeviceStatus {
  deviceId: string;
  kind: string;
  online: boolean;
  lastSeenAt: string;
}

export interface SiteState {
  siteId: string;
  devices: DeviceStatus[];
  openCount: number;
  dangerCount: number;
  warningCount: number;
  faultCount: number;
}

export interface EnvState {
  siteState: SiteState | null;
  setSiteState: (state: SiteState | null) => void;
}

export const useEnvStore = create<EnvState>((set) => ({
  siteState: null,
  setSiteState: (siteState) => set({ siteState }),
}));

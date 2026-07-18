/**
 * 디자인 토큰 — spec-app-ux.md §2 확정
 * 하드코딩 금지: 색·치수는 여기서만 정의, 컴포넌트는 토큰 참조만 허용.
 */

export const colors = {
  brand: {
    navy: '#1F3864',
  },
  severity: {
    danger: '#D64545',
    warning: '#D8940F',
    info: '#2E5496',
    fault: '#6B7280',
  },
  state: {
    ok: '#2E9E6B',
  },
  bg: {
    app: '#F4F6F9',
    card: '#FFFFFF',
  },
  line: '#E5EAF1',
  text: {
    main: '#1A2233',
    sub: '#6B7280',
    inverse: '#FFFFFF',
  },
} as const;

export const typography = {
  display: { fontSize: 24, fontWeight: '800' as const },
  title: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12.5, fontWeight: '500' as const },
  value: { fontSize: 28, fontWeight: '800' as const },
  badge: { fontSize: 11.5, fontWeight: '800' as const },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
} as const;

export const radius = {
  card: 12,
  button: 10,
} as const;

export const touchTarget = {
  min: 48,
  gap: 8,
} as const;

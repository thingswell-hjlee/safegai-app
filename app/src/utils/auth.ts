/**
 * 인증 헬퍼 — Amplify Auth 래핑 + Keychain 연동 (§6.1)
 *
 * - signIn: 이메일+비밀번호 로그인 → 토큰 Keychain 저장 → 역할 추출
 * - refreshSession: refreshToken으로 idToken 갱신
 * - signOut: 토큰 폐기 + Keychain 삭제
 * - getRole: cognito:groups에서 최고 역할 판정
 */
import { signIn as amplifySignIn, signOut as amplifySignOut, fetchAuthSession } from 'aws-amplify/auth';
import { saveTokens, clearTokens, loadTokens } from './secureStorage';

export type UserRole = 'admin' | 'teacher' | 'operator' | 'maintainer';

const ROLE_PRIORITY: Record<UserRole, number> = {
  admin: 4,
  teacher: 3,
  operator: 2,
  maintainer: 1,
};

export interface AuthResult {
  idToken: string;
  refreshToken: string;
  role: UserRole;
  email: string;
  userId: string;
}

/**
 * 이메일+비밀번호 로그인 → Keychain 저장
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  await amplifySignIn({ username: email, password });

  const session = await fetchAuthSession({ forceRefresh: true });
  const idToken = session.tokens?.idToken?.toString() ?? '';
  const refreshToken = ''; // Amplify v6 manages refresh internally

  // Keychain 보관
  await saveTokens({ idToken, refreshToken });

  // 역할 추출
  const payload = session.tokens?.idToken?.payload;
  const role = extractRole(payload);
  const userId = (payload?.sub as string) ?? '';
  const userEmail = (payload?.email as string) ?? email;

  return { idToken, refreshToken, role, email: userEmail, userId };
}

/**
 * 세션 복원 (앱 시작 시) — refreshToken 유효하면 홈 직행
 */
export async function restoreSession(): Promise<AuthResult | null> {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) return null;

    const payload = session.tokens?.idToken?.payload;
    const role = extractRole(payload);
    const userId = (payload?.sub as string) ?? '';
    const email = (payload?.email as string) ?? '';

    await saveTokens({ idToken, refreshToken: '' });
    return { idToken, refreshToken: '', role, email, userId };
  } catch {
    await clearTokens();
    return null;
  }
}

/**
 * idToken 갱신 (401 인터셉터용)
 */
export async function refreshIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString() ?? null;
    if (idToken) {
      await saveTokens({ idToken, refreshToken: '' });
    }
    return idToken;
  } catch {
    return null;
  }
}

/**
 * 로그아웃 — 토큰 폐기 + Keychain 삭제
 */
export async function signOut(): Promise<void> {
  try {
    await amplifySignOut();
  } catch {
    // 무시 — Keychain은 반드시 삭제
  }
  await clearTokens();
}

/**
 * cognito:groups → 최고 역할 판정
 */
function extractRole(payload: Record<string, unknown> | undefined): UserRole {
  if (!payload) return 'operator';

  const groups = payload['cognito:groups'];
  let roleList: string[] = [];

  if (typeof groups === 'string') {
    roleList = groups.replace(/[\[\]]/g, '').split(',').map((s) => s.trim());
  } else if (Array.isArray(groups)) {
    roleList = groups as string[];
  }

  const validRoles = roleList.filter((r): r is UserRole => r in ROLE_PRIORITY);
  if (validRoles.length === 0) return 'operator';

  validRoles.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]);
  return validRoles[0];
}

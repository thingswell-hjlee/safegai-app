/**
 * 인증 헬퍼 — Amplify Auth 래핑 (§6.1)
 *
 * 토큰 보관은 Amplify가 secureKVStorage(Keychain/Keystore)를 통해 직접 관리.
 * 이 모듈은 signIn/signOut/restoreSession/refreshIdToken + 역할 추출만 담당.
 */
import { signIn as amplifySignIn, signOut as amplifySignOut, fetchAuthSession } from 'aws-amplify/auth';
import { secureKVStorage } from './secureStorage';

export type UserRole = 'admin' | 'teacher' | 'operator' | 'maintainer';

const ROLE_PRIORITY: Record<UserRole, number> = {
  admin: 4,
  teacher: 3,
  operator: 2,
  maintainer: 1,
};

export interface AuthResult {
  idToken: string;
  role: UserRole;
  email: string;
  userId: string;
}

/**
 * 이메일+비밀번호 로그인
 * Amplify가 토큰을 secureKVStorage(Keychain)에 자동 저장.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  await amplifySignIn({ username: email, password });

  const session = await fetchAuthSession({ forceRefresh: true });
  const idToken = session.tokens?.idToken?.toString() ?? '';

  const payload = session.tokens?.idToken?.payload;
  const role = extractRole(payload);
  const userId = (payload?.sub as string) ?? '';
  const userEmail = (payload?.email as string) ?? email;

  return { idToken, role, email: userEmail, userId };
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

    return { idToken, role, email, userId };
  } catch {
    // 세션 만료 또는 오류 — 보안 저장소 클리어
    await secureKVStorage.clear();
    return null;
  }
}

/**
 * idToken 갱신 (401 인터셉터용)
 */
export async function refreshIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession({ forceRefresh: true });
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/**
 * 로그아웃 — Amplify signOut + 보안 저장소 클리어
 */
export async function signOut(): Promise<void> {
  try {
    await amplifySignOut();
  } catch {
    // 무시 — 보안 저장소는 반드시 클리어
  }
  await secureKVStorage.clear();
}

/**
 * cognito:groups → 최고 역할 판정
 * 무그룹 사용자에게는 최소 권한(maintainer)을 부여하여
 * 상위 UI(admin/teacher 기능)가 노출되지 않도록 한다.
 */
function extractRole(payload: Record<string, unknown> | undefined): UserRole {
  if (!payload) return 'maintainer';

  const groups = payload['cognito:groups'];
  let roleList: string[] = [];

  if (typeof groups === 'string') {
    roleList = groups.replace(/[\[\]]/g, '').split(',').map((s) => s.trim());
  } else if (Array.isArray(groups)) {
    roleList = groups as string[];
  }

  const validRoles = roleList.filter((r): r is UserRole => r in ROLE_PRIORITY);
  if (validRoles.length === 0) return 'maintainer';

  validRoles.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]);
  return validRoles[0];
}

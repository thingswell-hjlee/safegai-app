/**
 * shared/auth.mjs — JWT 권한 검사 유틸
 */

// 역할 계층: admin > teacher > operator > maintainer
const ROLE_HIERARCHY = {
  admin: 4,
  teacher: 3,
  operator: 2,
  maintainer: 1,
};

/**
 * JWT claims에서 Cognito 그룹(역할) 추출
 */
export function extractUserInfo(event) {
  // HTTP API v2 payload format
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims) {
    return null;
  }

  const groups = claims['cognito:groups'];
  // groups는 문자열("[admin, teacher]") 또는 배열
  let roles = [];
  if (typeof groups === 'string') {
    roles = groups.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(groups)) {
    roles = groups;
  }

  // 최고 역할 결정
  const primaryRole = roles.sort((a, b) => (ROLE_HIERARCHY[b] || 0) - (ROLE_HIERARCHY[a] || 0))[0] || 'operator';

  return {
    userId: claims.sub,
    email: claims.email || '',
    roles,
    primaryRole,
  };
}

/**
 * 역할 검사: 최소 역할 이상인지 확인
 * minRole: 'admin' | 'teacher' | 'operator' | 'maintainer'
 */
export function hasMinRole(userInfo, minRole) {
  if (!userInfo) return false;
  const required = ROLE_HIERARCHY[minRole] || 0;
  const userLevel = ROLE_HIERARCHY[userInfo.primaryRole] || 0;
  return userLevel >= required;
}

/**
 * 특정 역할 목록에 포함되는지 확인
 */
export function hasAnyRole(userInfo, allowedRoles) {
  if (!userInfo) return false;
  return userInfo.roles.some(r => allowedRoles.includes(r));
}

/**
 * 푸시 대상 역할 필터 (push-policy 기준)
 */
export function getPushTargetRoles(severity) {
  switch (severity) {
    case 'DANGER':
    case 'WARNING':
      return null; // 사이트 구독자 전체
    case 'FAULT':
      return ['admin', 'maintainer'];
    case 'INFO':
    default:
      return []; // 푸시 최소 (앱 내 알림 중심)
  }
}

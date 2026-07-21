/**
 * fnApi — REST 핸들러 (HTTP API → Lambda)
 *
 * spec-b.md §4 REST API 명세:
 * - GET  /events           목록 (GSI1 최신순, 전 역할)
 * - GET  /events/{id}      단건 상세 (전 역할)
 * - POST /events/{id}/ack  ack 기록, 에스컬레이션 중지 (teacher↑)
 * - POST /events/{id}/assign  담당 지정 (admin, 본인지정=teacher↑)
 * - POST /events/{id}/resolve  완료 (assignee·admin)
 * - GET  /site/state       devices 요약+미해결 수 (전 역할)
 * - POST /push/token       토큰 등록 (본인)
 * - DELETE /push/token      토큰 해제 (본인)
 * - POST /push/test        테스트 푸시 (본인)
 *
 * 공통 응답: { ok, data | error{code,msg} }. 페이지 20건.
 */
import { extractUserInfo, hasMinRole } from '../shared/auth.mjs';
import {
  getEvent,
  queryEventsBySite,
  transitionEventStatus,
  listDevices,
  queryOpenEvents,
  registerPushToken,
  removePushToken,
  getUser,
} from '../shared/db.mjs';
import { sendFcmMessage } from '../shared/fcm.mjs';
import {
  VALID_ROLES,
  listUsersWithRoles,
  createUser,
  setUserRole,
  setUserEnabled,
  setUserPassword,
} from '../shared/cognito.mjs';

export const handler = async (event) => {
  console.log('fnApi request:', event.routeKey || event.rawPath, event.httpMethod || event.requestContext?.http?.method);

  try {
    const userInfo = extractUserInfo(event);
    if (!userInfo) {
      return respond(401, { code: 'AUTH_DENIED', msg: '인증 정보가 없습니다.' });
    }

    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path || '';

    // ─── 라우팅 ────────────────────────────────────────────────────
    // GET /events
    if (method === 'GET' && path === '/events') {
      return await handleGetEvents(event, userInfo);
    }

    // GET /events/{id}
    const eventDetailMatch = path.match(/^\/events\/([^/]+)$/);
    if (method === 'GET' && eventDetailMatch) {
      return await handleGetEventDetail(eventDetailMatch[1], userInfo);
    }

    // POST /events/{id}/ack
    const ackMatch = path.match(/^\/events\/([^/]+)\/ack$/);
    if (method === 'POST' && ackMatch) {
      return await handleAck(ackMatch[1], userInfo);
    }

    // POST /events/{id}/assign
    const assignMatch = path.match(/^\/events\/([^/]+)\/assign$/);
    if (method === 'POST' && assignMatch) {
      return await handleAssign(assignMatch[1], event, userInfo);
    }

    // POST /events/{id}/resolve
    const resolveMatch = path.match(/^\/events\/([^/]+)\/resolve$/);
    if (method === 'POST' && resolveMatch) {
      return await handleResolve(resolveMatch[1], event, userInfo);
    }

    // GET /site/state
    if (method === 'GET' && path === '/site/state') {
      return await handleSiteState(userInfo);
    }

    // POST /push/token
    if (method === 'POST' && path === '/push/token') {
      return await handleRegisterToken(event, userInfo);
    }

    // DELETE /push/token
    if (method === 'DELETE' && path === '/push/token') {
      return await handleDeleteToken(event, userInfo);
    }

    // POST /push/test
    if (method === 'POST' && path === '/push/test') {
      return await handleTestPush(userInfo);
    }

    // ─── 계정 관리 (admin 전용) ────────────────────────────────────
    if (path === '/admin/users' || path.startsWith('/admin/users/')) {
      if (!hasMinRole(userInfo, 'admin')) {
        return respond(403, { code: 'ROLE_DENIED', msg: '관리자만 사용할 수 있습니다.' });
      }
      if (method === 'GET' && path === '/admin/users') {
        return respond(200, null, { users: await listUsersWithRoles() });
      }
      if (method === 'POST' && path === '/admin/users') {
        return await handleCreateUser(event);
      }
      const userMatch = path.match(/^\/admin\/users\/([^/]+)$/);
      if (method === 'PATCH' && userMatch) {
        return await handleUpdateUser(userMatch[1], event, userInfo);
      }
      const pwMatch = path.match(/^\/admin\/users\/([^/]+)\/password$/);
      if (method === 'POST' && pwMatch) {
        return await handleResetPassword(pwMatch[1], event);
      }
    }

    return respond(404, { code: 'NOT_FOUND', msg: '엔드포인트를 찾을 수 없습니다.' });
  } catch (err) {
    if (err.code === 'STATE_CONFLICT') {
      return respond(409, { code: 'STATE_CONFLICT', msg: err.message });
    }
    console.error('fnApi unhandled error:', err);
    return respond(500, { code: 'INTERNAL', msg: '서버 오류가 발생했습니다.' });
  }
};

// ════════════════════════════════════════════════════════════════════════
// 핸들러 구현
// ════════════════════════════════════════════════════════════════════════

/**
 * GET /events — 목록 (전 역할)
 * ?status&severity&limit&cursor → GSI1 최신순
 */
async function handleGetEvents(event, userInfo) {
  const qs = event.queryStringParameters || {};
  const siteId = qs.siteId || 'MAPO-01'; // 1개소 PoC: 기본 사이트

  const result = await queryEventsBySite(siteId, {
    limit: Math.min(parseInt(qs.limit) || 20, 20),
    cursor: qs.cursor || null,
    status: qs.status || null,
    severity: qs.severity || null,
  });

  return respond(200, null, { items: result.items, cursor: result.cursor });
}

/**
 * GET /events/{id} — 단건 상세 (전 역할)
 */
async function handleGetEventDetail(eventId, userInfo) {
  const item = await getEvent(eventId);
  if (!item) {
    return respond(404, { code: 'NOT_FOUND', msg: '이벤트를 찾을 수 없습니다.' });
  }
  return respond(200, null, item);
}

/**
 * POST /events/{id}/ack — ack 기록, 에스컬레이션 중지 (teacher↑)
 */
async function handleAck(eventId, userInfo) {
  if (!hasMinRole(userInfo, 'teacher')) {
    return respond(403, { code: 'AUTH_DENIED', msg: '교사 이상 권한이 필요합니다.' });
  }

  await transitionEventStatus(eventId, 'ACKED', {
    'ack.by': userInfo.userId,
    'ack.at': new Date().toISOString(),
  });

  return respond(200, null, { eventId, status: 'ACKED' });
}

/**
 * POST /events/{id}/assign — 담당 지정 (admin, 본인 지정은 teacher↑)
 */
async function handleAssign(eventId, event, userInfo) {
  const body = parseBody(event);
  const targetUserId = body?.userId;

  if (!targetUserId) {
    return respond(400, { code: 'INVALID', msg: 'userId가 필요합니다.' });
  }

  // 본인 지정은 teacher 이상, 타인 지정은 admin만
  const isSelfAssign = targetUserId === userInfo.userId;
  if (isSelfAssign) {
    if (!hasMinRole(userInfo, 'teacher')) {
      return respond(403, { code: 'AUTH_DENIED', msg: '교사 이상 권한이 필요합니다.' });
    }
  } else {
    if (!hasMinRole(userInfo, 'admin')) {
      return respond(403, { code: 'AUTH_DENIED', msg: '관리자 권한이 필요합니다.' });
    }
  }

  await transitionEventStatus(eventId, 'IN_PROGRESS', {
    'assignee.userId': targetUserId,
    'assignee.at': new Date().toISOString(),
  });

  return respond(200, null, { eventId, status: 'IN_PROGRESS', assignee: targetUserId });
}

/**
 * POST /events/{id}/resolve — 완료 (assignee·admin)
 */
async function handleResolve(eventId, event, userInfo) {
  const body = parseBody(event);

  // 권한 검사: assignee 본인 또는 admin
  const existing = await getEvent(eventId);
  if (!existing) {
    return respond(404, { code: 'NOT_FOUND', msg: '이벤트를 찾을 수 없습니다.' });
  }

  const isAssignee = existing.assignee?.userId === userInfo.userId;
  const isAdmin = hasMinRole(userInfo, 'admin');

  if (!isAssignee && !isAdmin) {
    return respond(403, { code: 'AUTH_DENIED', msg: '담당자 또는 관리자만 완료할 수 있습니다.' });
  }

  await transitionEventStatus(eventId, 'RESOLVED', {
    'resolve.by': userInfo.userId,
    'resolve.at': new Date().toISOString(),
    'resolve.note': body?.note || null,
  });

  return respond(200, null, { eventId, status: 'RESOLVED' });
}

/**
 * GET /site/state — devices 요약 + 미해결 수 (전 역할)
 */
async function handleSiteState(userInfo) {
  const siteId = 'MAPO-01'; // 1개소 PoC

  const [devices, openEvents] = await Promise.all([
    listDevices(),
    queryOpenEvents(siteId, 100),
  ]);

  const summary = {
    siteId,
    devices: devices.map(d => ({
      deviceId: d.deviceId,
      kind: d.kind,
      online: d.online,
      lastSeenAt: d.lastSeenAt,
    })),
    openCount: openEvents.length,
    dangerCount: openEvents.filter(e => e.severity === 'DANGER').length,
    warningCount: openEvents.filter(e => e.severity === 'WARNING').length,
    faultCount: openEvents.filter(e => e.severity === 'FAULT').length,
  };

  return respond(200, null, summary);
}

/**
 * POST /push/token — 토큰 등록 (본인)
 */
async function handleRegisterToken(event, userInfo) {
  const body = parseBody(event);
  if (!body?.token) {
    return respond(400, { code: 'INVALID', msg: 'token이 필요합니다.' });
  }

  const role = userInfo.primaryRole;
  const siteId = body.siteId || process.env.DEFAULT_SITE_ID || 'MAPO-01';

  await registerPushToken(userInfo.userId, body.token, body.device || 'unknown', role, siteId);
  return respond(200, null, { registered: true });
}

/**
 * DELETE /push/token — 토큰 해제 (본인)
 */
async function handleDeleteToken(event, userInfo) {
  const body = parseBody(event);
  if (!body?.token) {
    return respond(400, { code: 'INVALID', msg: 'token이 필요합니다.' });
  }

  await removePushToken(userInfo.userId, body.token);
  return respond(200, null, { removed: true });
}

/**
 * POST /push/test — 본인 기기 테스트 푸시 (본인)
 */
async function handleTestPush(userInfo) {
  const user = await getUser(userInfo.userId);
  if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
    return respond(400, { code: 'INVALID', msg: '등록된 푸시 토큰이 없습니다.' });
  }

  // 등록된 모든 토큰으로 테스트 전송 (하나라도 성공하면 sent=true)
  let anySuccess = false;
  for (const entry of user.fcmTokens) {
    const result = await sendFcmMessage(entry.token, {
      eventId: 'TEST',
      siteId: 'TEST',
      severity: 'INFO',
      type: 'EVENT',
      title: '푸시 테스트',
      body: '푸시 알림이 정상적으로 수신됩니다.',
      occurredAt: new Date().toISOString(),
    });
    if (result.success) anySuccess = true;
  }

  return respond(200, null, { sent: anySuccess });
}

// ════════════════════════════════════════════════════════════════════════
// 계정 관리 (admin 전용)
// ════════════════════════════════════════════════════════════════════════

/** POST /admin/users — 계정 생성(초대 메일 자동 발송) + 역할 부여 */
async function handleCreateUser(event) {
  const body = parseBody(event);
  const email = (body.email || '').trim().toLowerCase();
  const role = body.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(400, { code: 'INVALID', msg: '올바른 이메일 주소를 입력하세요.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return respond(400, { code: 'INVALID', msg: `역할은 ${VALID_ROLES.join('/')} 중 하나여야 합니다.` });
  }
  try {
    const { username } = await createUser(email, role);
    return respond(200, null, { username, email, role, invited: true });
  } catch (err) {
    if (err.name === 'UsernameExistsException') {
      return respond(409, { code: 'EXISTS', msg: '이미 등록된 이메일입니다.' });
    }
    throw err;
  }
}

/** PATCH /admin/users/{username} — 역할 변경·활성/비활성 */
async function handleUpdateUser(username, event, userInfo) {
  const body = parseBody(event);
  // 자기 자신 비활성화 방지(관리자 잠금 사고)
  if (body.enabled === false && username === userInfo.userId) {
    return respond(400, { code: 'INVALID', msg: '자기 자신은 비활성화할 수 없습니다.' });
  }
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return respond(400, { code: 'INVALID', msg: `역할은 ${VALID_ROLES.join('/')} 중 하나여야 합니다.` });
    }
    await setUserRole(username, body.role);
  }
  if (body.enabled !== undefined) {
    await setUserEnabled(username, !!body.enabled);
  }
  return respond(200, null, { updated: true });
}

/** POST /admin/users/{username}/password — 비밀번호 재설정(영구) */
async function handleResetPassword(username, event) {
  const body = parseBody(event);
  const password = body.password || '';
  if (password.length < 8) {
    return respond(400, { code: 'INVALID', msg: '비밀번호는 8자 이상이어야 합니다.' });
  }
  try {
    await setUserPassword(username, password);
    return respond(200, null, { reset: true });
  } catch (err) {
    if (err.name === 'InvalidPasswordException') {
      return respond(400, { code: 'INVALID', msg: '비밀번호 정책 위반: 대문자·소문자·숫자를 포함해 8자 이상이어야 합니다.' });
    }
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════════════
// 유틸리티
// ════════════════════════════════════════════════════════════════════════

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString()
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function respond(statusCode, error, data) {
  const body = error
    ? { ok: false, error }
    : { ok: true, data };

  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

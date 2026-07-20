/**
 * shared/fcm.mjs — FCM 전송 모듈
 * Google OAuth2 + FCM HTTP v1 API 사용
 * Node 내장 crypto로 RS256 JWT 서명 (외부 의존성 없음)
 */
import { createSign } from 'node:crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const smClient = new SecretsManagerClient({ region: 'ap-northeast-2' });
const FCM_SECRET_ARN = process.env.FCM_SECRET_ARN;

let cachedCredentials = null;
let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Secrets Manager에서 FCM 서비스 계정 키 로드 (캐싱)
 */
async function getServiceAccountKey() {
  if (cachedCredentials) return cachedCredentials;

  const res = await smClient.send(new GetSecretValueCommand({
    SecretId: FCM_SECRET_ARN,
  }));
  cachedCredentials = JSON.parse(res.SecretString);
  return cachedCredentials;
}

// ─── Node crypto RS256 JWT 서명 ──────────────────────────────────────

/**
 * Base64url 인코딩 (패딩 제거)
 */
function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

/**
 * RS256 JWT 생성 (Node 내장 crypto 사용)
 */
function signJwtRS256(payload, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload)),
  ];
  const signingInput = segments.join('.');

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(privateKeyPem, 'base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Google OAuth2 액세스 토큰 발급 (JWT assertion)
 */
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  const sa = await getServiceAccountKey();

  const jwt = signJwtRS256(
    {
      iss: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
  );

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error('OAuth2 token error:', errBody);
    throw new Error(`Failed to get access token: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);
  return cachedAccessToken;
}

/**
 * FCM 채널 매핑 (등급별)
 */
function getAndroidChannel(severity) {
  switch (severity) {
    case 'DANGER': return 'danger_channel';
    case 'WARNING': return 'warning_channel';
    case 'FAULT': return 'fault_channel';
    default: return 'info_channel';
  }
}

/**
 * FCM 메시지 전송 (단일 토큰)
 * notification + data 병행 (push-policy §4)
 */
export async function sendFcmMessage(token, { eventId, siteId, severity, type, title, body, occurredAt }) {
  const sa = await getServiceAccountKey();
  const accessToken = await getAccessToken();
  const projectId = sa.project_id;

  const message = {
    message: {
      token,
      notification: {
        title,
        body,
      },
      data: {
        eventId: eventId || '',
        siteId: siteId || '',
        severity: severity || '',
        type: type || 'EVENT',
        title: title || '',
        body: body || '',
        occurredAt: occurredAt || '',
      },
      android: {
        notification: {
          channelId: getAndroidChannel(severity),
          // FCM v1은 notification.priority가 아니라 notificationPriority(enum)
          notificationPriority: severity === 'DANGER' ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
        },
        priority: severity === 'DANGER' ? 'high' : 'normal',
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`FCM send failed for token ${token.slice(0, 10)}…:`, res.status, errBody);
    // 무효 토큰 감지 (404 또는 UNREGISTERED)
    if (res.status === 404 || errBody.includes('UNREGISTERED')) {
      return { success: false, unregistered: true };
    }
    return { success: false, unregistered: false };
  }

  return { success: true };
}

/**
 * 복수 사용자에게 FCM 전송 (사용자별 모든 토큰으로)
 * 무효 토큰은 반환하여 호출측에서 정리
 */
export async function sendFcmToUsers(users, payload) {
  const invalidTokens = []; // { userId, token }

  for (const user of users) {
    if (!user.fcmTokens || user.fcmTokens.length === 0) continue;

    for (const tokenEntry of user.fcmTokens) {
      const result = await sendFcmMessage(tokenEntry.token, payload);
      if (!result.success && result.unregistered) {
        invalidTokens.push({ userId: user.userId, token: tokenEntry.token });
      }
    }
  }

  return { invalidTokens };
}

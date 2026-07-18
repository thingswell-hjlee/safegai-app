/**
 * shared/db.mjs — DynamoDB 헬퍼
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const EVENTS_TABLE = process.env.EVENTS_TABLE || 'events';
const DEVICES_TABLE = process.env.DEVICES_TABLE || 'devices';
const USERS_TABLE = process.env.USERS_TABLE || 'users';

/**
 * events 테이블에 새 이벤트 삽입 (멱등: eventId가 이미 있으면 ConditionalCheckFailedException)
 */
export async function putEventIfNew(event) {
  const ttl90days = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  const item = {
    ...event,
    gsiSite: event.siteId,
    gsiTime: event.occurredAt,
    gsiOpen: `${event.siteId}#OPEN`,
    expireAt: ttl90days,
  };

  try {
    await ddb.send(new PutCommand({
      TableName: EVENTS_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(eventId)',
    }));
    return { isNew: true };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return { isNew: false };
    }
    throw err;
  }
}

/**
 * 재전송 처리: 조치 필드 보존, currentValue만 갱신
 */
export async function updateEventCurrentValue(eventId, currentValue) {
  await ddb.send(new UpdateCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
    UpdateExpression: 'SET currentValue = :val',
    ExpressionAttributeValues: { ':val': currentValue },
  }));
}

/**
 * devices 테이블 upsert: lastSeenAt 갱신, online 상태 설정
 */
export async function upsertDevice(deviceId, siteId, online, lastStatus) {
  await ddb.send(new UpdateCommand({
    TableName: DEVICES_TABLE,
    Key: { deviceId },
    UpdateExpression: 'SET siteId = :site, #on = :online, lastSeenAt = :ts, lastStatus = :st',
    ExpressionAttributeNames: { '#on': 'online' },
    ExpressionAttributeValues: {
      ':site': siteId,
      ':online': online,
      ':ts': new Date().toISOString(),
      ':st': lastStatus || null,
    },
  }));
}

/**
 * 단건 디바이스 조회
 */
export async function getDevice(deviceId) {
  const res = await ddb.send(new GetCommand({
    TableName: DEVICES_TABLE,
    Key: { deviceId },
  }));
  return res.Item || null;
}

/**
 * 단건 이벤트 조회
 */
export async function getEvent(eventId) {
  const res = await ddb.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
  }));
  return res.Item || null;
}

/**
 * GSI2 쿼리: siteId#OPEN인 이벤트 (에스컬레이션용)
 * severity 필터는 호출 측에서 처리
 */
export async function queryOpenEvents(siteId, limit = 100) {
  const res = await ddb.send(new QueryCommand({
    TableName: EVENTS_TABLE,
    IndexName: 'GSI2',
    KeyConditionExpression: 'gsiOpen = :pk',
    ExpressionAttributeValues: { ':pk': `${siteId}#OPEN` },
    ScanIndexForward: false, // 최신순
    Limit: limit,
  }));
  return res.Items || [];
}

/**
 * GSI2 쿼리: 모든 사이트의 OPEN 이벤트 (Scan 대안 — 사이트 목록 기반)
 * 1개소 PoC이므로 단일 사이트 하드코딩 대신 Scan 사용
 */
export async function scanOpenDangerEvents() {
  // PoC 단계: events 테이블 Scan (1개소·소량 데이터)
  // 프로덕션 시 사이트 목록 기반 GSI2 병렬 Query로 교체
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const res = await ddb.send(new ScanCommand({
    TableName: EVENTS_TABLE,
    FilterExpression: '#st = :open AND severity = :danger',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: { ':open': 'OPEN', ':danger': 'DANGER' },
  }));
  return res.Items || [];
}

/**
 * 이벤트 에스컬레이션 단계 기록
 */
export async function markEscalation(eventId, field) {
  await ddb.send(new UpdateCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
    UpdateExpression: `SET ${field} = :t`,
    ExpressionAttributeValues: { ':t': new Date().toISOString() },
  }));
}

/**
 * GSI1 쿼리: siteId 기준 최신순 이벤트 목록 (페이지네이션)
 */
export async function queryEventsBySite(siteId, { limit = 20, cursor, status, severity } = {}) {
  let filterParts = [];
  let exprValues = { ':pk': siteId };
  let exprNames = {};

  if (status) {
    filterParts.push('#st = :status');
    exprValues[':status'] = status;
    exprNames['#st'] = 'status';
  }
  if (severity) {
    filterParts.push('severity = :sev');
    exprValues[':sev'] = severity;
  }

  const params = {
    TableName: EVENTS_TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'gsiSite = :pk',
    ExpressionAttributeValues: exprValues,
    ScanIndexForward: false,
    Limit: limit,
  };

  if (filterParts.length > 0) {
    params.FilterExpression = filterParts.join(' AND ');
  }
  if (Object.keys(exprNames).length > 0) {
    params.ExpressionAttributeNames = exprNames;
  }
  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  }

  const res = await ddb.send(new QueryCommand(params));
  const nextCursor = res.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64url')
    : null;

  return { items: res.Items || [], cursor: nextCursor };
}

/**
 * 이벤트 상태 전이 (역행 금지)
 */
const STATUS_ORDER = { OPEN: 0, ACKED: 1, IN_PROGRESS: 2, RESOLVED: 3 };

export async function transitionEventStatus(eventId, newStatus, updateFields) {
  const statusIdx = STATUS_ORDER[newStatus];
  if (statusIdx === undefined) throw new Error(`Invalid status: ${newStatus}`);

  // 현재보다 상위 상태로만 전이 허용
  const allowedPrev = Object.entries(STATUS_ORDER)
    .filter(([, v]) => v < statusIdx)
    .map(([k]) => k);

  if (allowedPrev.length === 0) {
    throw { code: 'STATE_CONFLICT', message: 'Cannot transition to this status' };
  }

  let updateParts = ['#st = :newStatus', 'gsiOpen = :gsiOpen'];
  let exprValues = {
    ':newStatus': newStatus,
    ':gsiOpen': newStatus === 'RESOLVED' ? `__RESOLVED__` : undefined,
    ...Object.entries(updateFields || {}).reduce((acc, [k, v], i) => {
      updateParts.push(`${k} = :uf${i}`);
      acc[`:uf${i}`] = v;
      return acc;
    }, {}),
  };

  // gsiOpen 업데이트: RESOLVED이면 GSI2에서 제거 (gsiOpen을 null이 아닌 dummy로 설정)
  if (newStatus !== 'RESOLVED') {
    delete exprValues[':gsiOpen'];
    updateParts = updateParts.filter(p => p !== 'gsiOpen = :gsiOpen');
  }

  const conditionValues = allowedPrev.reduce((acc, s, i) => {
    acc[`:prev${i}`] = s;
    return acc;
  }, {});

  const conditionExpr = `#st IN (${allowedPrev.map((_, i) => `:prev${i}`).join(',')})`;

  try {
    await ddb.send(new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { eventId },
      UpdateExpression: 'SET ' + updateParts.join(', '),
      ConditionExpression: conditionExpr,
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ...exprValues, ...conditionValues },
    }));
    return { success: true };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw { code: 'STATE_CONFLICT', message: '상태 역행 또는 이미 처리됨' };
    }
    throw err;
  }
}

/**
 * devices 테이블 전체 조회 (1개소 소량)
 */
export async function listDevices() {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const res = await ddb.send(new ScanCommand({ TableName: DEVICES_TABLE }));
  return res.Items || [];
}

/**
 * users 테이블: siteId 구독자 조회 (역할 필터)
 */
export async function getUsersBySite(siteId, roles) {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const res = await ddb.send(new ScanCommand({ TableName: USERS_TABLE }));
  const users = res.Items || [];
  return users.filter(u =>
    u.siteIds && u.siteIds.includes(siteId) &&
    (!roles || roles.includes(u.role))
  );
}

/**
 * users 테이블: 사용자 조회
 */
export async function getUser(userId) {
  const res = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));
  return res.Item || null;
}

/**
 * users 테이블: FCM 토큰 등록
 */
export async function registerPushToken(userId, token, deviceInfo) {
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: 'SET fcmTokens = list_append(if_not_exists(fcmTokens, :empty), :tok)',
    ExpressionAttributeValues: {
      ':tok': [{ token, device: deviceInfo, registeredAt: new Date().toISOString() }],
      ':empty': [],
    },
  }));
}

/**
 * users 테이블: FCM 토큰 해제
 */
export async function removePushToken(userId, token) {
  const user = await getUser(userId);
  if (!user || !user.fcmTokens) return;
  const updated = user.fcmTokens.filter(t => t.token !== token);
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: 'SET fcmTokens = :tokens',
    ExpressionAttributeValues: { ':tokens': updated },
  }));
}

export { ddb, EVENTS_TABLE, DEVICES_TABLE, USERS_TABLE };

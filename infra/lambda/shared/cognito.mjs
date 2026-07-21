/**
 * shared/cognito.mjs — 계정 관리 (admin 전용 API에서 사용)
 * env: USER_POOL_ID
 */
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({ region: 'ap-northeast-2' });
const POOL = process.env.USER_POOL_ID;

export const VALID_ROLES = ['admin', 'teacher', 'operator', 'maintainer'];

function attr(user, name) {
  return (user.Attributes || user.UserAttributes || []).find((a) => a.Name === name)?.Value || '';
}

/** 사용자 목록 (+각자의 역할 그룹) */
export async function listUsersWithRoles() {
  const res = await client.send(new ListUsersCommand({ UserPoolId: POOL, Limit: 60 }));
  const users = [];
  for (const u of res.Users || []) {
    let roles = [];
    try {
      const g = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: POOL, Username: u.Username }));
      roles = (g.Groups || []).map((x) => x.GroupName);
    } catch { /* 그룹 조회 실패 시 빈 목록 */ }
    users.push({
      username: u.Username,
      email: attr(u, 'email'),
      name: attr(u, 'name'),
      roles,
      enabled: u.Enabled !== false,
      status: u.UserStatus,           // CONFIRMED | FORCE_CHANGE_PASSWORD ...
      createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : null,
    });
  }
  return users;
}

/** 계정 생성 — 초대 메일(임시 비밀번호) 자동 발송 + 역할 그룹 부여 */
export async function createUser(email, role) {
  const res = await client.send(new AdminCreateUserCommand({
    UserPoolId: POOL,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
  }));
  const username = res.User.Username;
  await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL, Username: username, GroupName: role }));
  return { username };
}

/** 역할 변경 — 기존 역할 그룹 전부 제거 후 새 역할 부여 */
export async function setUserRole(username, role) {
  const g = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: POOL, Username: username }));
  for (const grp of g.Groups || []) {
    if (VALID_ROLES.includes(grp.GroupName) && grp.GroupName !== role) {
      await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL, Username: username, GroupName: grp.GroupName }));
    }
  }
  await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL, Username: username, GroupName: role }));
}

/** 활성/비활성 */
export async function setUserEnabled(username, enabled) {
  const Cmd = enabled ? AdminEnableUserCommand : AdminDisableUserCommand;
  await client.send(new Cmd({ UserPoolId: POOL, Username: username }));
}

/** 비밀번호 재설정(영구) — 관리자가 지정해 당사자에게 전달하는 운영 방식 */
export async function setUserPassword(username, password) {
  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: POOL, Username: username, Password: password, Permanent: true,
  }));
}

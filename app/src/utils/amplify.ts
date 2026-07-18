/**
 * Amplify Auth 초기화 — spec-app-ux.md §6.1
 *
 * 실제 배포 값:
 * - UserPoolId: ap-northeast-2_agrpIWKKD
 * - AppClientId: 2hk9k0ep0ibmfn9mdgfr53opin
 * - Region: ap-northeast-2
 */
import { Amplify } from 'aws-amplify';

export function initAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: 'ap-northeast-2_agrpIWKKD',
        userPoolClientId: '2hk9k0ep0ibmfn9mdgfr53opin',
      },
    },
  });
}

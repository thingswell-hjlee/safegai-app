/**
 * Amplify Auth 초기화 — spec-app-ux.md §6.1
 *
 * 실제 배포 값:
 * - UserPoolId: ap-northeast-2_agrpIWKKD
 * - AppClientId: 2hk9k0ep0ibmfn9mdgfr53opin
 * - Region: ap-northeast-2
 *
 * 토큰 저장소: AsyncStorage(평문) 대신 Keychain/Keystore 사용.
 * cognitoUserPoolsTokenProvider.setKeyValueStorage(secureKVStorage)
 */
import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { secureKVStorage } from './secureStorage';

export function initAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: 'ap-northeast-2_agrpIWKKD',
        userPoolClientId: '2hk9k0ep0ibmfn9mdgfr53opin',
      },
    },
  });

  // 토큰 저장소를 Keychain/Keystore 기반으로 교체 (AsyncStorage 평문 금지)
  cognitoUserPoolsTokenProvider.setKeyValueStorage(secureKVStorage);
}

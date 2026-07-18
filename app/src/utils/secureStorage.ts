/**
 * Keychain/Keystore 보관 — AsyncStorage 평문 금지 (§6.1)
 *
 * idToken / refreshToken을 Keychain(iOS) / Keystore(Android)에 안전하게 보관.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'kr.co.thingswell.safegai';

export interface StoredTokens {
  idToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {
    service: SERVICE_NAME,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE_NAME });
  if (!result) return null;
  try {
    return JSON.parse(result.password) as StoredTokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE_NAME });
}

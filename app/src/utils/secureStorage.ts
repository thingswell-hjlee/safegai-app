/**
 * secureKVStorage — Amplify v6 토큰 저장소를 Keychain/Keystore로 교체 (§6.1)
 *
 * Amplify의 cognitoUserPoolsTokenProvider.setKeyValueStorage()에 전달하여
 * 토큰이 AsyncStorage(평문)가 아닌 Keychain(iOS)/Keystore(Android)에 저장되게 한다.
 *
 * KeyValueStorage 인터페이스: setItem, getItem, removeItem, clear
 */
import * as Keychain from 'react-native-keychain';

const SERVICE_PREFIX = 'kr.co.thingswell.safegai';

/**
 * Keychain은 key-value 쌍을 다수 저장하기 어렵다 (단일 username/password).
 * 따라서 모든 KV를 JSON 맵으로 직렬화하여 하나의 Keychain 엔트리에 보관한다.
 */
async function readStore(): Promise<Record<string, string>> {
  const result = await Keychain.getGenericPassword({ service: SERVICE_PREFIX });
  if (!result || !result.password) return {};
  try {
    return JSON.parse(result.password) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, string>): Promise<void> {
  await Keychain.setGenericPassword('amplify-kv', JSON.stringify(store), {
    service: SERVICE_PREFIX,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Amplify KeyValueStorage 인터페이스 구현 (Keychain/Keystore 백엔드)
 */
export const secureKVStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const store = await readStore();
    store[key] = value;
    await writeStore(store);
  },

  async getItem(key: string): Promise<string | null> {
    const store = await readStore();
    return store[key] ?? null;
  },

  async removeItem(key: string): Promise<void> {
    const store = await readStore();
    delete store[key];
    await writeStore(store);
  },

  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE_PREFIX });
  },
};

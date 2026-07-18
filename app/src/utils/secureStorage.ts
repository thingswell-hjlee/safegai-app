/**
 * secureKVStorage — Amplify v6 토큰 저장소를 Keychain/Keystore로 교체 (§6.1)
 *
 * Amplify의 cognitoUserPoolsTokenProvider.setKeyValueStorage()에 전달하여
 * 토큰이 AsyncStorage(평문)가 아닌 Keychain(iOS)/Keystore(Android)에 저장되게 한다.
 *
 * KeyValueStorage 인터페이스: setItem, getItem, removeItem, clear
 *
 * 동시 쓰기 경합(race condition) 방지:
 * 모든 연산을 모듈 스코프 promise 체인으로 직렬화하여
 * 한 번에 하나의 read-modify-write만 실행되도록 보장한다.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE_PREFIX = 'kr.co.thingswell.safegai';

// ─── 비동기 큐(뮤텍스) ──────────────────────────────────────────────────
// promise 체인으로 모든 KV 연산을 순차 실행. 동시 호출 시 선입 선처리.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = queue.then(fn, fn); // 이전 작업 성공/실패 무관하게 순차 실행
  queue = task.then(() => {}, () => {}); // 체인 유지 (에러 전파 방지)
  return task;
}

// ─── 내부 Keychain 읽기/쓰기 (큐 내에서만 호출) ──────────────────────────
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

// ─── Amplify KeyValueStorage 인터페이스 (직렬화 보장) ─────────────────────
export const secureKVStorage = {
  setItem(key: string, value: string): Promise<void> {
    return enqueue(async () => {
      const store = await readStore();
      store[key] = value;
      await writeStore(store);
    });
  },

  getItem(key: string): Promise<string | null> {
    return enqueue(async () => {
      const store = await readStore();
      return store[key] ?? null;
    });
  },

  removeItem(key: string): Promise<void> {
    return enqueue(async () => {
      const store = await readStore();
      delete store[key];
      await writeStore(store);
    });
  },

  clear(): Promise<void> {
    return enqueue(async () => {
      await Keychain.resetGenericPassword({ service: SERVICE_PREFIX });
    });
  },
};

import { outputJSON, readJSON } from 'fs-extra/esm';
import L from './logger';

export interface Store {
  lastCodeDemoId: Record<string, string>;
  lastContinueToken: Record<string, string>;
  refreshToken: Record<string, string>;
}

const storeFile = 'config/store.json';

export const readStore = async (): Promise<Store> => {
  try {
    const store = (await readJSON(storeFile, 'utf-8')) as Store | undefined;
    if (typeof store === 'object') {
      return store;
    }
  } catch (err) {
    L.warn({ err }, 'Error reading store JSON');
  }
  return { lastCodeDemoId: {}, lastContinueToken: {}, refreshToken: {} };
};

export const getStoreValue = async (
  type: keyof Store,
  accountName: string,
): Promise<string | undefined> => {
  const store = await readStore();
  return store[type]?.[accountName];
};

export const setStore = (store: Store): Promise<void> => {
  return outputJSON(storeFile, store, { encoding: 'utf-8' });
};

export const setStoreValue = async (
  type: keyof Store,
  accountName: string,
  value: string,
): Promise<void> => {
  L.trace({ type, accountName, value }, 'Setting store value');
  const store = await readStore();
  if (!store[type]) {
    store[type] = {};
  }
  store[type][accountName] = value;
  return setStore(store);
};

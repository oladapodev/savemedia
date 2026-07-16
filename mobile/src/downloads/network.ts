import type { NetworkStatus } from './ports';

export type NativeNetworkState = { isConnected?: boolean; isInternetReachable?: boolean | null };

export interface NetworkNativeDependencies {
  getState(): Promise<NativeNetworkState>;
  subscribe(listener: (state: NativeNetworkState) => void): () => void;
}

function online(state: NativeNetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function createNetworkStatus(native: NetworkNativeDependencies): NetworkStatus {
  return {
    async getCurrent() {
      return { online: online(await native.getState()) };
    },
    subscribe(listener) {
      return native.subscribe((state) => listener({ online: online(state) }));
    },
  };
}

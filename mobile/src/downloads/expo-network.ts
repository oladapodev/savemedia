import * as Network from 'expo-network';

import { createNetworkStatus } from './network';

export const expoNetworkStatus = createNetworkStatus({
  getState: () => Network.getNetworkStateAsync(),
  subscribe(listener) {
    const subscription = Network.addNetworkStateListener(listener);
    return () => subscription.remove();
  },
});

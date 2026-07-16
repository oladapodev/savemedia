import { createNetworkStatus, type NetworkNativeDependencies } from './network';

test('maps Expo connectivity and disposes its listener', async () => {
  let nativeListener!: (state: { isConnected?: boolean; isInternetReachable?: boolean }) => void;
  const remove = jest.fn();
  const native: NetworkNativeDependencies = {
    getState: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: false }),
    subscribe: jest.fn().mockImplementation((listener) => {
      nativeListener = listener;
      return remove;
    }),
  };
  const network = createNetworkStatus(native);
  const listener = jest.fn();

  await expect(network.getCurrent()).resolves.toEqual({ online: false });
  const dispose = network.subscribe(listener);
  nativeListener({ isConnected: true, isInternetReachable: null as unknown as boolean });
  dispose();

  expect(listener).toHaveBeenCalledWith({ online: true });
  expect(remove).toHaveBeenCalledTimes(1);
});

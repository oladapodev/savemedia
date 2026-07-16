import { act, render } from '@testing-library/react-native';

import { NotificationEdge } from './edge';

test('notification edge owns lifecycle setup and routes taps without route infrastructure', async () => {
  const dispose = jest.fn();
  const lifecycle = {
    configureForegroundHandler: jest.fn(),
    addResponseListener: jest.fn().mockReturnValue(dispose),
  };
  const openHistory = jest.fn();
  const view = await render(<NotificationEdge lifecycle={lifecycle} openHistory={openHistory} />);
  const listener = lifecycle.addResponseListener.mock.calls[0][0];
  listener({ jobId: 'job-1', assetUri: 'ph://one' });
  await act(async () => { view.unmount(); });

  expect(openHistory).toHaveBeenCalledWith('job-1');
  expect(dispose).toHaveBeenCalledTimes(1);
});

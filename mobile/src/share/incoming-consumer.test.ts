import { clearIncomingShareOnce, consumeIncomingShareOnce } from './incoming-consumer';

test('shares one in-flight consumption across duplicate StrictMode effects', async () => {
  let resolve!: (value: { kind: 'saved' }) => void;
  const task = jest.fn().mockReturnValue(new Promise<{ kind: 'saved' }>((done) => { resolve = done; }));

  const first = consumeIncomingShareOnce('strict-mode-key', task);
  const second = consumeIncomingShareOnce('strict-mode-key', task);
  resolve({ kind: 'saved' });

  await expect(Promise.all([first, second])).resolves.toEqual([{ kind: 'saved' }, { kind: 'saved' }]);
  expect(task).toHaveBeenCalledTimes(1);
});

test('allows shared payload cleanup exactly once after an outcome exists', async () => {
  await consumeIncomingShareOnce('clear-key', async () => ({ kind: 'rejected' as const }));
  const clear = jest.fn().mockResolvedValue(undefined);

  await Promise.all([
    clearIncomingShareOnce('clear-key', clear),
    clearIncomingShareOnce('clear-key', clear),
  ]);
  expect(clear).toHaveBeenCalledTimes(1);
});

test('does not mark cleanup complete until it succeeds and permits retry', async () => {
  await expect(consumeIncomingShareOnce('rejected-key', async () => {
    throw new Error('controller unavailable');
  })).rejects.toThrow('controller unavailable');
  const clear = jest.fn()
    .mockRejectedValueOnce(new Error('queue busy'))
    .mockResolvedValueOnce(undefined);

  await expect(clearIncomingShareOnce('rejected-key', clear)).rejects.toThrow('queue busy');
  await expect(clearIncomingShareOnce('rejected-key', clear)).resolves.toBeUndefined();
  expect(clear).toHaveBeenCalledTimes(2);
});

test('allows a later identical share after the StrictMode replay window', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  const first = jest.fn().mockResolvedValue({ kind: 'saved' });
  await consumeIncomingShareOnce('repeat-key', first);
  await clearIncomingShareOnce('repeat-key', async () => undefined);

  now.mockReturnValue(7_001);
  const repeated = jest.fn().mockResolvedValue({ kind: 'duplicate' });
  await consumeIncomingShareOnce('repeat-key', repeated);

  expect(first).toHaveBeenCalledTimes(1);
  expect(repeated).toHaveBeenCalledTimes(1);
  now.mockRestore();
});

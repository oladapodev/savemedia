type ConsumptionEntry = {
  promise: Promise<unknown>;
  recordedAt: number;
  outcomeRecorded: boolean;
  cleared: boolean;
  clearPromise?: Promise<void>;
};

const MAX_RECORDED_CONSUMPTIONS = 64;
const STRICT_MODE_REPLAY_WINDOW_MS = 5_000;
const consumptions = new Map<string, ConsumptionEntry>();

function trimOldConsumptions(): void {
  while (consumptions.size > MAX_RECORDED_CONSUMPTIONS) {
    const oldest = consumptions.keys().next().value as string | undefined;
    if (!oldest) return;
    consumptions.delete(oldest);
  }
}

export function consumeIncomingShareOnce<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = consumptions.get(key);
  if (existing) {
    if (!existing.cleared || Date.now() - existing.recordedAt <= STRICT_MODE_REPLAY_WINDOW_MS) {
      return existing.promise as Promise<T>;
    }
    consumptions.delete(key);
  }

  const entry: ConsumptionEntry = {
    promise: Promise.resolve(),
    recordedAt: 0,
    outcomeRecorded: false,
    cleared: false,
  };
  entry.promise = Promise.resolve()
    .then(task)
    .then((outcome) => {
      entry.outcomeRecorded = true;
      entry.recordedAt = Date.now();
      return outcome;
    }, (error: unknown) => {
      entry.outcomeRecorded = true;
      entry.recordedAt = Date.now();
      throw error;
    });
  consumptions.set(key, entry);
  trimOldConsumptions();
  return entry.promise as Promise<T>;
}

export function clearIncomingShareOnce(key: string, task: () => Promise<void> | void): Promise<void> {
  const entry = consumptions.get(key);
  if (!entry?.outcomeRecorded) return Promise.reject(new Error('Incoming share outcome is not recorded.'));
  if (entry.cleared) return Promise.resolve();
  if (entry.clearPromise) return entry.clearPromise;
  const operation = Promise.resolve()
    .then(task)
    .then(() => { entry.cleared = true; })
    .finally(() => {
      if (entry.clearPromise === operation) entry.clearPromise = undefined;
    });
  entry.clearPromise = operation;
  return operation;
}

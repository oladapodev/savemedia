import { deleteDownload } from './delete';

const item = { id: 'job-1', deviceAssetRef: 'ph://clip' };

describe('deleteDownload', () => {
  test('removes only the history record for the history-only choice', async () => {
    const deleteAsset = jest.fn();
    const removeRecord = jest.fn().mockResolvedValue(undefined);

    await expect(deleteDownload(item, 'history-only', { deleteAsset, removeRecord })).resolves.toEqual({ kind: 'deleted' });

    expect(deleteAsset).not.toHaveBeenCalled();
    expect(removeRecord).toHaveBeenCalledWith('job-1');
  });

  test('verifies device deletion before removing its history record', async () => {
    const order: string[] = [];
    const result = await deleteDownload(item, 'device-and-history', {
      deleteAsset: async () => {
        order.push('device');
        return true;
      },
      removeRecord: async () => {
        order.push('history');
      },
    });

    expect(result).toEqual({ kind: 'deleted' });
    expect(order).toEqual(['device', 'history']);
  });

  test('preserves history when device deletion fails', async () => {
    const removeRecord = jest.fn();
    const result = await deleteDownload(item, 'device-and-history', {
      deleteAsset: async () => { throw new Error('denied'); },
      removeRecord,
    });

    expect(result.kind).toBe('permission_error');
    expect(removeRecord).not.toHaveBeenCalled();
  });

  test('preserves history when device deletion cannot be verified', async () => {
    const removeRecord = jest.fn();
    const result = await deleteDownload(item, 'device-and-history', {
      deleteAsset: async () => false,
      removeRecord,
    });

    expect(result).toEqual({ kind: 'device_error' });
    expect(removeRecord).not.toHaveBeenCalled();
  });

  test('reports a history-only removal failure before any device deletion', async () => {
    const deleteAsset = jest.fn();
    const result = await deleteDownload(item, 'history-only', {
      deleteAsset,
      removeRecord: async () => { throw new Error('database busy'); },
    });

    expect(result).toEqual({ kind: 'history_error', deviceDeleted: false });
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  test('reports when device media was already deleted before history removal failed', async () => {
    const result = await deleteDownload(item, 'device-and-history', {
      deleteAsset: async () => true,
      removeRecord: async () => { throw new Error('database busy'); },
    });

    expect(result).toEqual({ kind: 'history_error', deviceDeleted: true });
  });
});

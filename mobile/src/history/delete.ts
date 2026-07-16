export type HistoryDeleteChoice = 'history-only' | 'device-and-history';
export type DeletableHistoryItem = { id: string; deviceAssetRef: string | null };
export type DeleteDownloadDependencies = {
  deleteAsset(assetRef: string): Promise<boolean>;
  removeRecord(id: string): Promise<void>;
};
export type DeleteDownloadResult =
  | { kind: 'deleted' }
  | { kind: 'permission_error' }
  | { kind: 'device_error' }
  | { kind: 'history_error'; deviceDeleted: boolean };

/** Deletes device media first; history remains intact if that deletion is not confirmed. */
export async function deleteDownload(
  item: DeletableHistoryItem,
  choice: HistoryDeleteChoice,
  dependencies: DeleteDownloadDependencies,
): Promise<DeleteDownloadResult> {
  if (choice === 'history-only') {
    return removeHistory(item.id, false, dependencies);
  }
  if (!item.deviceAssetRef) return { kind: 'device_error' };
  try {
    const deleted = await dependencies.deleteAsset(item.deviceAssetRef);
    if (!deleted) return { kind: 'device_error' };
  } catch (error) {
    return isPermissionError(error) ? { kind: 'permission_error' } : { kind: 'device_error' };
  }
  return removeHistory(item.id, true, dependencies);
}

async function removeHistory(
  id: string,
  deviceDeleted: boolean,
  dependencies: DeleteDownloadDependencies,
): Promise<DeleteDownloadResult> {
  try {
    await dependencies.removeRecord(id);
    return { kind: 'deleted' };
  } catch {
    return { kind: 'history_error', deviceDeleted };
  }
}

function isPermissionError(error: unknown): boolean {
  return error instanceof Error && /(denied|permission|unauthori[sz]ed)/i.test(error.message);
}

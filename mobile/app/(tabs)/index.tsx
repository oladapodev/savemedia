import { useDownloads } from '../../src/downloads/context';
import { HomeScreen } from '../../src/features/home/home';

function downloadDebug(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test') return;
  if (details) console.log(`[iMediaSave][route] ${event}`, details);
  else console.log(`[iMediaSave][route] ${event}`);
}

export default function HomeRoute() {
  const downloads = useDownloads();
  const { home } = downloads;
  const runAction = (label: string, action: () => Promise<unknown> | void) => {
    downloadDebug(`${label}: start`, { phase: home.phase, jobId: home.jobId });
    try {
      void Promise.resolve(action())
        .then(() => downloadDebug(`${label}: complete`))
        .catch((error: unknown) => {
          downloadDebug(`${label}: failed`, {
            message: error instanceof Error ? error.message : 'unknown',
          });
        });
    } catch (error) {
      downloadDebug(`${label}: threw synchronously`, {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  };

  const primary = () => {
    if (home.phase === 'ready' || home.phase === 'link_detected') return downloads.pasteAndDownload();
    if ((home.phase === 'complete' || home.phase === 'duplicate') && home.assetUri) return downloads.open(home.assetUri);
    if (home.phase === 'duplicate') return downloads.downloadAgain();
    if ((home.phase === 'failed' || home.phase === 'paused_offline') && home.jobId) return downloads.retry(home.jobId);
    if (home.jobId) return downloads.cancel(home.jobId);
    return undefined;
  };
  const secondary = () => {
    if (home.phase === 'complete' && home.assetUri) return downloads.share(home.assetUri);
    if (home.phase === 'duplicate') return downloads.downloadAgain();
    if (home.phase === 'failed') return downloads.pasteAndDownload();
    if (home.jobId) return downloads.cancel(home.jobId);
    return undefined;
  };

  return (
    <HomeScreen
      model={home}
      onChooseMedia={(selection) => {
        const jobId = home.jobId;
        if (jobId) runAction('chooseMedia', () => downloads.chooseMedia(jobId, selection));
      }}
      onPrimaryAction={() => { runAction('primaryAction', primary); }}
      onSecondaryAction={() => { runAction('secondaryAction', secondary); }}
      onSubmitUrl={(url) => { runAction('submitUrl', () => downloads.startSharedUrl(url)); }}
    />
  );
}

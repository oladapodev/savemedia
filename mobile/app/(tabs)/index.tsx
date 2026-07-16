import { useDownloads } from '../../src/downloads/context';
import { HomeScreen } from '../../src/features/home/home';

export default function HomeRoute() {
  const downloads = useDownloads();
  const { home } = downloads;
  const runAction = (action: () => Promise<unknown> | void) => {
    try {
      void Promise.resolve(action()).catch(() => undefined);
    } catch {}
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
        if (jobId) runAction(() => downloads.chooseMedia(jobId, selection));
      }}
      onPrimaryAction={() => { runAction(primary); }}
      onSecondaryAction={() => { runAction(secondary); }}
      onSubmitUrl={(url) => { runAction(() => downloads.startSharedUrl(url)); }}
    />
  );
}

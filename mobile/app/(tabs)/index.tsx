import { useDownloads } from '../../src/downloads/context';
import { HomeScreen } from '../../src/features/home/home';

export default function HomeRoute() {
  const downloads = useDownloads();
  const { home } = downloads;

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
      onChooseMedia={async (selection) => { if (home.jobId) await downloads.chooseMedia(home.jobId, selection); }}
      onPrimaryAction={async () => { await primary(); }}
      onSecondaryAction={async () => { await secondary(); }}
    />
  );
}

import { useRouter } from 'expo-router';
import { useDownloads } from '../../src/downloads/context';
import { HomeScreen } from '../../src/features/home/home';

export default function HomeRoute() {
  const downloads = useDownloads();
  const router = useRouter();
  const { home } = downloads;
  const runAction = (action: () => Promise<unknown> | void) => {
    try {
      void Promise.resolve(action()).catch(() => undefined);
    } catch {
      // DownloadProvider converts route-facing failures into visible notices.
    }
  };
  const primary = () => {
    if (home.phase === 'link_detected') return downloads.pasteAndDownload();
    if ((home.phase === 'complete' || home.phase === 'duplicate') && home.assetUri) return downloads.open(home.assetUri);
    if (home.phase === 'duplicate') return downloads.downloadAgain();
    if ((home.phase === 'failed' || home.phase === 'paused_offline') && home.jobId) return downloads.retry(home.jobId);
    if (home.phase === 'failed') return downloads.pasteAndDownload();
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

  return <HomeScreen model={home}
    onChooseMedia={(selection) => { if (home.jobId) runAction(() => downloads.chooseMedia(home.jobId!, selection)); }}
    onPrimaryAction={() => runAction(primary)}
    onSecondaryAction={() => runAction(secondary)}
    onSubmitUrl={async (url) => { if (await downloads.inspectUrl(url)) router.push('/media/preview'); }} />;
}

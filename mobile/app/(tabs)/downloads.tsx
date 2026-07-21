import { useDownloads } from '../../src/downloads/context';
import { DownloadsScreen } from '../../src/features/downloads/downloads';

export default function DownloadsRoute() {
  const downloads = useDownloads();
  return <DownloadsScreen items={downloads.downloads.items} notice={downloads.downloads.notice}
    onCancel={(item) => { void downloads.cancel(item.id); }}
    onChoose={(item, selection) => { void downloads.chooseMedia(item.id, selection); }} />;
}

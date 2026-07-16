import { LegalScreen, type LegalSection } from './screen';

const privacySections: readonly LegalSection[] = [
  {
    title: 'Clipboard and shared content',
    body: 'Your clipboard is read only after you tap Paste & download. The app does not monitor it in the background. Shared URLs and files are received only when you choose iMediaSave from your device share controls.',
  },
  {
    title: 'Public wrapper processing',
    body: 'A URL you explicitly paste or share, along with the requested download options, is sent to the public iMediaSave wrapper API. That service and its private media processor may contact the source platform to inspect and prepare the requested media. Files shared directly from your device are validated locally and are not uploaded through this direct-file flow.',
  },
  {
    title: 'On-device data and temporary files',
    body: 'Download history and settings are stored in a local SQLite database on this device. The database also keeps active, failed, completed, and cancelled job records, including source URLs and technical state used for recovery. Temporary working files may be kept in app storage while a download is prepared, transferred, retried, or exported. Completed media is exported to your device Photos or media library when permission allows.',
  },
  {
    title: 'Permissions and notifications',
    body: 'Media-library permission is requested when it is needed to export or manage saved media. If completion notifications are enabled, notification permission may be requested when the app needs to send one. Denying either permission keeps the related feature unavailable without changing the rest of the app.',
  },
  {
    title: 'Accounts and tracking',
    body: 'The current mobile app does not require an account and does not include advertising or analytics trackers. Network hosts and source platforms may still process routine connection data under their own terms when a request is made.',
  },
  {
    title: 'Retention and deletion',
    body: "Visible history remains on this device until you clear it. Removing a visible history entry also removes its completed app-local job record and source URL; where offered, you can separately choose whether to remove exported device media. Hidden failed or cancelled job records may remain for recovery or diagnostics until you clear the app's storage or uninstall the app. Exported media must be deleted separately unless you choose the device-and-history deletion option. Temporary-file controls remove eligible app working files without deleting exported media. Server caches, security records, and technical logs may be retained by the deployment or infrastructure providers according to their configured operational needs.",
  },
  {
    title: 'Security and contact',
    body: 'The app separates private processing credentials from the public wrapper, but no device or internet service can guarantee absolute security. No contact channel is configured in this app for privacy or security requests.',
  },
];

export function PrivacyScreen({ onBack }: { onBack: () => void }) {
  return (
    <LegalScreen
      onBack={onBack}
      sections={privacySections}
      subtitle="What the mobile app processes, stores, and shares."
      title="Privacy Policy"
    />
  );
}

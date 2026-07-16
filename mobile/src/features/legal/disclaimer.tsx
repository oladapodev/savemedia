import { LegalScreen, type LegalSection } from './screen';

const disclaimerSections: readonly LegalSection[] = [
  {
    title: 'Authorized use',
    body: 'Use only content you created, own, or have permission to download, or that applicable law otherwise allows. Do not bypass access controls, paywalls, digital rights management, privacy settings, or geographic restrictions.',
  },
  {
    title: 'Rights and platform terms',
    body: "Access to a file does not transfer copyright, privacy, publicity, or contractual rights. You must follow the source platform's terms and obtain any permission required to save, share, publish, or reuse media.",
  },
  {
    title: 'Independent service',
    body: 'iMediaSave is an independent utility. It is not affiliated with, sponsored by, or endorsed by any source platform. Platform names, icons, logos, and trademarks remain the property of their respective owners.',
  },
  {
    title: 'Availability and output limits',
    body: 'The service is provided as available. Platform changes, private or deleted media, network conditions, rate limits, and provider failures may prevent processing. Not every platform, link, quality, format, or download will work, and generated metadata or files may be incomplete or unavailable.',
  },
  {
    title: 'Your responsibility',
    body: 'You are responsible for the URLs and files you submit, what you download, how you store or share it, and the consequences of your use. Verify that downloaded output is appropriate and safe before relying on or distributing it.',
  },
  {
    title: 'Not legal advice',
    body: 'This notice is general product information, not legal advice. Laws and platform terms vary by location and circumstance; seek qualified advice when needed.',
  },
];

export function DisclaimerScreen({ onBack }: { onBack: () => void }) {
  return (
    <LegalScreen
      onBack={onBack}
      sections={disclaimerSections}
      subtitle="Rights, responsibilities, and service limits."
      title="Disclaimer and Responsible Use"
    />
  );
}

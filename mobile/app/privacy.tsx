import { useRouter } from 'expo-router';

import { PrivacyScreen } from '../src/features/legal/privacy';

export default function PrivacyRoute() {
  const router = useRouter();
  return <PrivacyScreen onBack={() => router.replace('/settings')} />;
}

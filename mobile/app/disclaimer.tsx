import { useRouter } from 'expo-router';

import { DisclaimerScreen } from '../src/features/legal/disclaimer';

export default function DisclaimerRoute() {
  const router = useRouter();
  return <DisclaimerScreen onBack={() => router.replace('/settings')} />;
}

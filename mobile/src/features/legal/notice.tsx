import { Modal } from 'react-native';

import { Button, Screen, Stack, Surface, Text } from '../../ui';

type OwnershipNoticeProps = {
  accepting?: boolean;
  blockingError?: string;
  error?: string;
  onAccept: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  visible: boolean;
};

export function OwnershipNotice({
  accepting = false,
  blockingError,
  error,
  onAccept,
  onRetry,
  retrying = false,
  visible,
}: OwnershipNoticeProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => undefined}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <Screen
        accessibilityViewIsModal
        scroll
        testID="ownership-notice-scroll"
      >
        <Stack gap="lg" grow>
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title">
              {blockingError ? 'App data unavailable' : 'Before your first download'}
            </Text>
            <Text color="textMuted">
              {blockingError
                ? 'Downloads and settings changes are paused to protect unread app data.'
                : 'Save only content you own or have permission to download.'}
            </Text>
          </Stack>
          {blockingError ? (
            <Surface tone="surfaceMuted">
              <Stack gap="sm">
                <Text accessibilityRole="alert">App data could not be loaded</Text>
                <Text color="danger">{blockingError}</Text>
                <Text color="textMuted">
                  Retry loading app data. No downloads or settings changes will continue until loading succeeds.
                </Text>
              </Stack>
            </Surface>
          ) : (
            <Surface tone="surfaceMuted">
              <Stack gap="sm">
                <Text accessibilityRole="alert">Responsible use notice</Text>
                <Text variant="label">Use iMediaSave responsibly</Text>
                <Text color="textMuted">
                  You are responsible for following copyright, privacy, and platform terms. Do not bypass access controls or save private content without permission.
                </Text>
              </Stack>
            </Surface>
          )}
          {error && !blockingError ? (
            <Text accessibilityLiveRegion="polite" color="danger">
              {error}
            </Text>
          ) : null}
          {blockingError ? (
            <Button
              accessibilityLabel="Retry loading app data"
              label="Retry loading app data"
              loading={retrying}
              onPress={onRetry}
            />
          ) : (
            <Button
              accessibilityLabel="Accept responsible use notice"
              label="I understand and accept"
              loading={accepting}
              onPress={onAccept}
              testID="ownership-notice-accept"
            />
          )}
        </Stack>
      </Screen>
    </Modal>
  );
}

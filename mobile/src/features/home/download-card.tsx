import { Button, Stack, Surface, Text } from '../../ui';
import type { HomeScreenModel } from './home';
import type { DownloadSelection } from '../../downloads/types';

type DownloadCardProps = {
  model: HomeScreenModel;
  onChooseMedia?: (selection: DownloadSelection) => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

export function DownloadCard({
  model,
  onChooseMedia,
  onPrimaryAction,
  onSecondaryAction,
}: DownloadCardProps) {
  return (
    <Surface level="raised" padding="lg">
      <Stack gap="lg">
        <Stack gap="sm">
          <Text variant="title">{model.cardTitle}</Text>
          <Text color="textMuted">{model.cardDetail}</Text>
          {model.fileName ? <Text variant="label">{model.fileName}</Text> : null}
        </Stack>
        {model.mediaChoices?.map((choice) => (
          <Button
            accessibilityLabel={`Choose ${choice.label}`}
            key={choice.id}
            label={choice.label}
            onPress={() => onChooseMedia?.(choice.selection)}
            variant="secondary"
          />
        ))}
        <Button
          label={model.primaryAction.label}
          onPress={onPrimaryAction}
          variant={model.primaryAction.variant}
        />
        {model.secondaryAction ? (
          <Button
            label={model.secondaryAction.label}
            onPress={onSecondaryAction}
            variant={model.secondaryAction.variant ?? 'secondary'}
          />
        ) : null}
      </Stack>
    </Surface>
  );
}

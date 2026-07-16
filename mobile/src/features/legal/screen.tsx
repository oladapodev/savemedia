import type { ReactNode } from 'react';

import { Button, PageHeader, Screen, Stack, Surface, Text } from '../../ui';

export type LegalSection = {
  body: ReactNode;
  title: string;
};

type LegalScreenProps = {
  onBack: () => void;
  sections: readonly LegalSection[];
  subtitle: string;
  title: string;
};

export function LegalScreen({ onBack, sections, subtitle, title }: LegalScreenProps) {
  return (
    <Screen scroll>
      <Stack gap="lg">
        <PageHeader subtitle={subtitle} title={title} />
        {sections.map((section) => (
          <Surface key={section.title}>
            <Stack gap="sm">
              <Text accessibilityRole="header" variant="label">{section.title}</Text>
              <Text color="textMuted">{section.body}</Text>
            </Stack>
          </Surface>
        ))}
        <Button
          accessibilityLabel="Back to Settings"
          label="Back to Settings"
          onPress={onBack}
          variant="secondary"
        />
      </Stack>
    </Screen>
  );
}

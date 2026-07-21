import { View, useWindowDimensions } from 'react-native';

import { MotionPressable } from './motion';
import { radius, space } from './tokens';
import { Text } from './text';
import { useTheme } from './theme';

export type Choice<Value extends string = string> = {
  accessibilityLabel?: string;
  label: string;
  value: Value;
};

type ChoiceOptions<Value extends string> =
  | readonly [Choice<Value>, Choice<Value>]
  | readonly [Choice<Value>, Choice<Value>, Choice<Value>]
  | readonly [Choice<Value>, Choice<Value>, Choice<Value>, Choice<Value>];

export type ChoiceBarProps<Value extends string = string> = {
  accessibilityLabel?: string;
  choices: ChoiceOptions<Value>;
  onChange: (value: Value) => void;
  value: Value;
};

export function getChoiceBarDirection({ fontScale, width }: { fontScale: number; width: number }): 'column' | 'row' {
  return width < 360 || fontScale >= 1.3 ? 'column' : 'row';
}

export function ChoiceBar<Value extends string>({ accessibilityLabel, choices, onChange, value }: ChoiceBarProps<Value>) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const direction = getChoiceBarDirection({ fontScale, width });

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="toolbar"
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: radius.control,
        borderWidth: 1,
        flexDirection: direction,
        flexShrink: 1,
        gap: space.xs,
        maxWidth: '100%',
        minWidth: 0,
        padding: space.xs,
        width: '100%',
      }}
    >
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <MotionPressable
            accessibilityLabel={choice.accessibilityLabel ?? choice.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={choice.value}
            onPress={() => onChange(choice.value)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: selected ? colors.surface : 'transparent',
              borderColor: selected ? colors.action : 'transparent',
              borderRadius: radius.control - space.xs,
              borderWidth: 1,
              flex: direction === 'row' ? 1 : undefined,
              justifyContent: 'center',
              minHeight: 40,
              minWidth: 0,
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: space.xs,
              paddingVertical: space.sm,
              width: direction === 'column' ? '100%' : undefined,
            })}
          >
            <Text
              color={selected ? 'accent' : 'textMuted'}
              numberOfLines={1}
              style={{ flexShrink: 1, maxWidth: '100%', minWidth: 0, textAlign: 'center' }}
              variant="label"
            >
              {choice.label}
            </Text>
          </MotionPressable>
        );
      })}
    </View>
  );
}

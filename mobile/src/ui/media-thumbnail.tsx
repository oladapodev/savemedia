import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icon';
import { MotionPressable } from './motion';
import { radius } from './tokens';
import { useTheme } from './theme';

export function MediaThumbnail({ fallbackIcon = 'image', label, onError, style, uri }: {
  fallbackIcon?: IconName;
  label: string;
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
  uri?: string;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(uri));

  useEffect(() => {
    setFailed(false);
    setLoading(Boolean(uri));
  }, [uri]);

  const retry = () => {
    setFailed(false);
    setLoading(true);
  };

  return <View accessibilityLabel={failed || !uri ? `${label} unavailable` : undefined}
    style={[{ alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.control,
      justifyContent: 'center', overflow: 'hidden' }, style]}>
    {loading && !failed ? <ActivityIndicator color={colors.accent} size="small" /> : null}
    {failed && uri ? <MotionPressable accessibilityLabel={`Retry ${label}`} accessibilityRole="button" onPress={retry}
      style={{ alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 }}>
      <Icon color="textMuted" name={fallbackIcon} size={26} />
    </MotionPressable> : null}
    {!uri ? <Icon color="textMuted" name={fallbackIcon} size={26} /> : null}
    {uri && !failed ? <Image accessibilityLabel={label} accessibilityRole="image"
      onError={() => { setFailed(true); setLoading(false); onError?.(); }} onLoadEnd={() => setLoading(false)}
      resizeMode="cover" source={{ uri }} style={{ bottom: 0, height: '100%', left: 0,
        position: 'absolute', right: 0, top: 0, width: '100%' }} /> : null}
  </View>;
}

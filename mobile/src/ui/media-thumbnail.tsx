import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icon';
import { radius } from './tokens';
import { useTheme } from './theme';

export function MediaThumbnail({ fallbackIcon = 'image', label, style, uri }: {
  fallbackIcon?: IconName;
  label: string;
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

  return <View accessibilityLabel={failed || !uri ? `${label} unavailable` : undefined}
    style={[{ alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.control,
      justifyContent: 'center', overflow: 'hidden' }, style]}>
    {loading && !failed ? <ActivityIndicator color={colors.accent} size="small" /> : null}
    {failed || !uri ? <Icon color="textMuted" name={fallbackIcon} size={26} /> : null}
    {uri && !failed ? <Image accessibilityLabel={label} accessibilityRole="image"
      onError={() => { setFailed(true); setLoading(false); }} onLoadEnd={() => setLoading(false)}
      resizeMode="cover" source={{ uri }} style={{ bottom: 0, height: '100%', left: 0,
        position: 'absolute', right: 0, top: 0, width: '100%' }} /> : null}
  </View>;
}

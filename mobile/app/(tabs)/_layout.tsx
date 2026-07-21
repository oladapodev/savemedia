import { Tabs } from 'expo-router';
import { Icon, tabItems, useTheme } from '../../src/ui';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.canvas },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarHideOnKeyboard: true,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarShowLabel: true,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, elevation: 0, paddingTop: 5 },
    }}>
      {tabItems.map((item) => <Tabs.Screen key={item.name} name={item.name} options={{
        title: item.label,
        tabBarAccessibilityLabel: item.label,
        tabBarIcon: ({ focused, size }) => <Icon color={focused ? 'accent' : 'textMuted'} name={item.icon} size={Math.min(size, 22)} />,
      }} />)}
    </Tabs>
  );
}

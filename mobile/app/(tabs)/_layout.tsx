import { Tabs } from 'expo-router';
import { AnimatedFocus, Icon, getTabMotion, tabItems, useMotionDisabled, useTheme } from '../../src/ui';

export default function TabLayout() {
  const { colors } = useTheme();
  const motionDisabled = useMotionDisabled();
  const tabMotion = getTabMotion(motionDisabled);
  return (
    <Tabs screenOptions={{
      ...tabMotion,
      headerShown: false,
      sceneStyle: { backgroundColor: colors.canvas },
      tabBarActiveBackgroundColor: colors.surfaceMuted,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarHideOnKeyboard: true,
      tabBarItemStyle: { borderRadius: 18, marginVertical: 5 },
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarShowLabel: true,
      tabBarStyle: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1,
        elevation: 0, marginBottom: 8, marginHorizontal: 12, minHeight: 64, paddingTop: 5 },
    }}>
      {tabItems.map((item) => <Tabs.Screen key={item.name} name={item.name} options={{
        title: item.label,
        tabBarAccessibilityLabel: item.label,
        tabBarIcon: ({ focused, size }) => <AnimatedFocus active={focused}>
          <Icon color={focused ? 'accent' : 'textMuted'} name={item.icon} size={Math.min(size, 22)} />
        </AnimatedFocus>,
      }} />)}
    </Tabs>
  );
}

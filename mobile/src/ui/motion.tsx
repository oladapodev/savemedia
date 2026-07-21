import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { motion } from './tokens';

export function resolveMotion(disabled: boolean) {
  return disabled ? motion.reduced : motion.standard;
}

export function isMotionDisabled(reduceMotion: boolean | null, screenReader: boolean | null) {
  return reduceMotion !== false || screenReader !== false;
}

export function capRevealDelay(delay: number) {
  return Math.max(0, Math.min(delay, 40));
}

export function useMotionDisabled() {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [screenReader, setScreenReader] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      const [reduceMotion, screenReader] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(),
        AccessibilityInfo.isScreenReaderEnabled(),
      ]);
      if (mounted) {
        setReduceMotion(reduceMotion);
        setScreenReader(screenReader);
      }
    };
    void update();
    const reduceSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const readerSubscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      mounted = false;
      reduceSubscription.remove();
      readerSubscription.remove();
    };
  }, []);

  return isMotionDisabled(reduceMotion, screenReader);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({ disabled = false, onPressIn, onPressOut, style, ...props }: PressableProps) {
  const motionDisabled = useMotionDisabled();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const animate = (value: number) => {
    const duration = resolveMotion(motionDisabled).feedbackDuration;
    if (duration === 0) {
      scale.setValue(value);
      return;
    }
    Animated.timing(scale, { duration, easing: Easing.out(Easing.cubic), toValue: value, useNativeDriver: true }).start();
  };
  const pressableState: PressableStateCallbackType = { pressed };

  return <AnimatedPressable {...props} disabled={disabled}
    onPressIn={(event) => { setPressed(true); if (!disabled) animate(0.98); onPressIn?.(event); }}
    onPressOut={(event) => { setPressed(false); animate(1); onPressOut?.(event); }}
    style={[typeof style === 'function' ? style(pressableState) : style, { transform: [{ scale }] }]} />;
}

export function Reveal({ children, delay = 0, distance, style }: PropsWithChildren<{
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const motionDisabled = useMotionDisabled();
  const progress = useRef(new Animated.Value(motionDisabled ? 1 : 0)).current;
  const policy = resolveMotion(motionDisabled);
  const travel = distance ?? policy.decorativeDistance;

  useEffect(() => {
    if (motionDisabled) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      delay: capRevealDelay(delay),
      duration: policy.stateDuration,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, motionDisabled, policy.stateDuration, progress]);

  return <Animated.View style={[{ opacity: progress, transform: [{ translateY: progress.interpolate({
    inputRange: [0, 1], outputRange: [travel, 0],
  }) }] }, style]}>{children}</Animated.View>;
}

export function AnimatedFocus({ active, children }: { active: boolean; children: ReactNode }) {
  const motionDisabled = useMotionDisabled();
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const duration = resolveMotion(motionDisabled).stateDuration;
    if (duration === 0) {
      progress.setValue(active ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      duration,
      easing: Easing.out(Easing.cubic),
      toValue: active ? 1 : 0,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, motionDisabled, progress]);

  return <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>;
}

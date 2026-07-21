import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Image, Pressable, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Icon, Inline, Stack, radius, space, useTheme } from '../../ui';

export type PromoSlide = { id: string; image: number; label: string };

export const promoSlides: readonly PromoSlide[] = [
  { id: 'favorite', image: require('../../../assets/promos/promo-1.jpg'), label: 'Save your favorite moments' },
  { id: 'instant', image: require('../../../assets/promos/promo-2.jpg'), label: 'Download what you love instantly' },
  { id: 'possibilities', image: require('../../../assets/promos/promo-3.jpg'), label: 'One link, endless possibilities' },
  { id: 'clean', image: require('../../../assets/promos/promo-4.jpg'), label: 'Clean downloads without watermarks or ads' },
  { id: 'platforms', image: require('../../../assets/promos/promo-5.jpg'), label: 'Download from social media in one place' },
];

export function shouldAnimateCarouselNavigation(motionBlocked: boolean) {
  return !motionBlocked;
}

export function getPromoSize(candidateWidth: number) {
  const width = Math.max(1, Math.floor(candidateWidth));
  return { height: Math.max(1, Math.round(width / 2)), width };
}

export function PromoCarousel({ autoAdvanceMs = 4_000, slides = promoSlides }: {
  autoAdvanceMs?: number; slides?: readonly PromoSlide[];
}) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const fallbackWidth = useMemo(() => Math.max(1, Math.min(windowWidth, 720) - (space.md * 2)), [windowWidth]);
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const width = measuredWidth ?? fallbackWidth;
  const frame = getPromoSize(width);
  const listRef = useRef<FlatList<PromoSlide>>(null);
  const previousWidthRef = useRef(width);
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [paused, setPaused] = useState(false);
  const motionBlocked = reduceMotion || screenReader;

  const show = useCallback((index: number) => {
    if (slides.length === 0) return;
    const next = Math.max(0, Math.min(index, slides.length - 1));
    setActive(next);
    listRef.current?.scrollToIndex({ animated: shouldAnimateCarouselNavigation(motionBlocked), index: next });
  }, [motionBlocked, slides.length]);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      const [shouldReduceMotion, isScreenReaderEnabled] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled(),
      ]);
      if (mounted) {
        setReduceMotion(shouldReduceMotion);
        setScreenReader(isScreenReaderEnabled);
      }
    };
    void update();
    const reduceMotionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const screenReaderSubscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      mounted = false;
      reduceMotionSubscription.remove();
      screenReaderSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (dragging || motionBlocked || paused || slides.length < 2) return undefined;
    const timer = setTimeout(() => show((active + 1) % slides.length), autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [active, autoAdvanceMs, dragging, motionBlocked, paused, show, slides.length]);

  useEffect(() => {
    if (previousWidthRef.current === width) return;
    previousWidthRef.current = width;
    listRef.current?.scrollToOffset({ animated: false, offset: active * width });
  }, [active, width]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.x / width), slides.length - 1)));
    setDragging(false);
  };

  return <Stack gap={0} onLayout={(event) => setMeasuredWidth(Math.max(1, Math.floor(event.nativeEvent.layout.width)))}>
    <FlatList data={[...slides]} decelerationRate="fast" getItemLayout={(_, index) => ({ index, length: width, offset: width * index })}
      accessibilityLabel="Promotional highlights" horizontal keyExtractor={(item) => item.id} onMomentumScrollEnd={settle} onScrollBeginDrag={() => setDragging(true)}
      onScrollEndDrag={() => setDragging(false)} pagingEnabled ref={listRef} showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => <View style={frame}><Image accessibilityLabel={item.label} accessibilityRole="image"
        resizeMode="cover" source={item.image} style={{ borderRadius: radius.card, height: frame.height, width: frame.width }} /></View>}
      style={{ borderRadius: radius.card, height: frame.height, width: frame.width }} />
    <Inline gap={0} justify="center">
      {slides.map((slide, index) => <Pressable accessibilityLabel={`Show promotion ${index + 1}`} accessibilityRole="button"
        accessibilityState={{ selected: index === active }} key={slide.id} onPress={() => show(index)}
        hitSlop={6} style={{ alignItems: 'center', height: 32, justifyContent: 'center', width: 32 }}>
        <View pointerEvents="none" style={{ backgroundColor: index === active ? colors.accent : colors.border,
          borderRadius: 99, height: 7, width: index === active ? 20 : 7 }} />
      </Pressable>)}
      {slides.length > 1 && !motionBlocked ? <Pressable accessibilityLabel={paused ? 'Resume promotions' : 'Pause promotions'}
        accessibilityRole="button" hitSlop={6} onPress={() => setPaused((value) => !value)}
        style={{ alignItems: 'center', height: 32, justifyContent: 'center', width: 32 }}>
        <Icon color="textMuted" name={paused ? 'play' : 'pause'} size={15} />
      </Pressable> : null}
    </Inline>
  </Stack>;
}

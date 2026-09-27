import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';

import type { FullSwipe, SwipeAction } from './useFullSwipe';

/** The jump the mark makes when the line is crossed, either way. */
const POP: WithSpringConfig = { damping: 12, stiffness: 420, mass: 0.5 };
/** Over the first few points the colour fades in, so its corners never flash under a still row. */
const FADE_IN = 24;

const REMOVE_COLOR = '#E2685E';
const RESET_COLOR = '#3266AE';

export type FullSwipeBackdropProps = {
  swipe: FullSwipe;
  /** Match your rows' corners, so the ones that come out from under a row belong to it. Defaults to `16`. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The colour behind the row, the whole row wide: the left action's on the
 * right, where swiping left opens the gap, and the right action's on the left.
 * Place it first inside the view that took `swipe.onLayout`, with the row after it.
 *
 * Each mark stays by the edge where its gap opens, grows as the line comes up
 * and jumps when it is crossed, so the moment letting go would commit is felt
 * rather than worked out.
 *
 * It is not a button, because the action is committed by letting go, so screen
 * readers are not shown it. Give them `swipe.accessibilityProps` instead.
 */
export function FullSwipeBackdrop({ swipe, borderRadius = 16, style }: FullSwipeBackdropProps) {
  // Taken out on their own: a worklet that reached through `swipe` would try to
  // copy the gesture in it onto the UI thread, and a gesture cannot be copied.
  const { translateX, armed, width, threshold, left, right } = swipe;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {left ? (
        <ActionLayer
          sign={-1}
          action={left}
          translateX={translateX}
          armed={armed}
          width={width}
          threshold={threshold}
          borderRadius={borderRadius}
          style={style}
        />
      ) : null}
      {right ? (
        <ActionLayer
          sign={1}
          action={right}
          translateX={translateX}
          armed={armed}
          width={width}
          threshold={threshold}
          borderRadius={borderRadius}
          style={style}
        />
      ) : null}
    </View>
  );
}

function ActionLayer({
  sign,
  action,
  translateX,
  armed,
  width,
  threshold,
  borderRadius,
  style,
}: {
  sign: -1 | 1;
  action: SwipeAction;
  translateX: SharedValue<number>;
  armed: SharedValue<boolean>;
  width: SharedValue<number>;
  threshold: number;
  borderRadius: number;
  style?: StyleProp<ViewStyle>;
}) {
  const color = action.color ?? ((action.after ?? 'remove') === 'remove' ? REMOVE_COLOR : RESET_COLOR);

  const pop = useDerivedValue(() =>
    withSpring(armed.value && sign * translateX.value > 0 ? 1.2 : 1, POP),
  );

  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sign * translateX.value, [0, FADE_IN], [0, 1], 'clamp'),
  }));

  const markStyle = useAnimatedStyle(() => {
    const over = sign * translateX.value;
    const line = Math.max(1, width.value * threshold);
    const toward = interpolate(over, [0, line], [0.6, 1], 'clamp');
    return {
      opacity: interpolate(over, [0, line * 0.6], [0, 1], 'clamp'),
      transform: [{ scale: toward * pop.value }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.back,
        { backgroundColor: color, borderRadius },
        sign < 0 ? styles.alignEnd : styles.alignStart,
        style,
        backStyle,
      ]}
    >
      <Animated.View style={[styles.mark, markStyle]}>
        {action.content ?? (
          <>
            {action.icon}
            {action.label ? (
              <Text style={[styles.label, action.labelStyle]}>{action.label}</Text>
            ) : null}
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 28,
  },
  alignEnd: { justifyContent: 'flex-end' },
  alignStart: { justifyContent: 'flex-start' },
  mark: { alignItems: 'center', gap: 4 },
  label: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' },
});

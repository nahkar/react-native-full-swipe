import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { FullSwipeBackdrop } from './FullSwipeBackdrop';
import {
  useFullSwipe,
  type FullSwipeOptions,
  type SwipeAccessibilityProps,
  type SwipeSide,
} from './useFullSwipe';

export type SwipeRowProps = FullSwipeOptions & {
  /**
   * The row itself. It has to be opaque, or the backdrop shows through it.
   *
   * Pass a function to get the actions as screen-reader actions, and spread
   * them onto the row's focusable element:
   * `{(a11y) => <Pressable {...a11y}>…</Pressable>}`.
   */
  children: ReactNode | ((accessibilityProps: SwipeAccessibilityProps) => ReactNode);
  /** Match your rows' corners. Defaults to `16`. */
  borderRadius?: number;
  /** The outer view, which the backdrop fills. */
  style?: StyleProp<ViewStyle>;
  /** The view that slides. */
  rowStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export type SwipeRowHandle = {
  /** Commits a side's action, as a completed swipe would. */
  trigger: (side: SwipeSide) => void;
  /** Springs the row back to rest. */
  reset: () => void;
};

/**
 * A row with an action on each side, committed by swiping it past the line:
 * {@link useFullSwipe} and {@link FullSwipeBackdrop} put together.
 */
export const SwipeRow = forwardRef<SwipeRowHandle, SwipeRowProps>(function SwipeRow(
  { children, borderRadius, style, rowStyle, backdropStyle, testID, ...options },
  ref,
) {
  const swipe = useFullSwipe(options);
  const { translateX } = swipe;

  useImperativeHandle(ref, () => ({ trigger: swipe.trigger, reset: swipe.reset }), [
    swipe.trigger,
    swipe.reset,
  ]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View onLayout={swipe.onLayout} style={style} testID={testID}>
      <FullSwipeBackdrop swipe={swipe} borderRadius={borderRadius} style={backdropStyle} />
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[rowStyle, slide]}>
          {typeof children === 'function' ? children(swipe.accessibilityProps) : children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

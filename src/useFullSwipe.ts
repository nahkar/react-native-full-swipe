import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import type {
  AccessibilityActionEvent,
  AccessibilityActionInfo,
  LayoutChangeEvent,
  StyleProp,
  TextStyle,
} from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  runOnUI,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';

/** The way the row is swiped: `'left'` drags it to the left, uncovering the right-hand side. */
export type SwipeSide = 'left' | 'right';

/**
 * What an action may answer. For an action that removes its row: nothing,
 * `true` or a promise of either lets the removal stand; `false`, a promise of
 * `false` or a rejected promise brings the row back.
 */
export type ActionResult = void | boolean | Promise<void | boolean>;

export type SwipeAction = {
  /** Called once the swipe is committed. */
  onAction: () => ActionResult;
  /**
   * What the row does once the swipe is committed:
   *
   * - `'remove'` (default): it is carried off the edge, and `onAction` runs once
   *   it is gone. Take it out of your list there. For delete, archive, move.
   * - `'reset'`: `onAction` runs at once and the row springs back. For mark as
   *   read, pin, favourite: anything that leaves the row in the list.
   */
  after?: 'remove' | 'reset';
  /** Text under the icon, e.g. "Delete". Also names the accessibility action. */
  label?: string;
  icon?: ReactNode;
  /** Defaults to red for `'remove'` and blue for `'reset'`. */
  color?: string;
  labelStyle?: StyleProp<TextStyle>;
  /** Replaces the icon and label. It still grows and jumps with the swipe. */
  content?: ReactNode;
  /** Names the accessibility action when `label` is not enough, or is missing. */
  accessibilityLabel?: string;
};

export type FullSwipeOptions = {
  /** The action for swiping the row to the left. */
  left?: SwipeAction;
  /** The action for swiping the row to the right. */
  right?: SwipeAction;
  /** `false` leaves the row standing still. Defaults to `true`. */
  enabled?: boolean;
  /** Share of the row's width past which letting go commits the action. Defaults to `0.4`. */
  threshold?: number;
  /** A flick at least this fast (points per second) commits from a shorter swipe. Defaults to `1200`. */
  flickVelocity?: number;
  /**
   * How far over, as a share of the width, the row must be for a flick to count,
   * so a quick twitch of the thumb never commits anything. Defaults to `0.2`.
   */
  flickThreshold?: number;
  /** How long the row takes to leave, in ms. Defaults to `180`. */
  sweepDuration?: number;
  /** The spring back to rest. */
  springConfig?: WithSpringConfig;
  /** Sideways travel, in points, before the swipe takes over. Defaults to `14`. */
  activeOffsetX?: number;
  /** Vertical travel before the swipe gives up, so the list behind still scrolls. Defaults to `12`. */
  failOffsetY?: number;
  /**
   * Called on the JS thread whenever the finger drags the row across the line,
   * either way. Not called for the sweep off the edge or the spring back. The
   * place to fire a haptic: `armed && Haptics.impactAsync()`.
   */
  onArmedChange?: (armed: boolean, side: SwipeSide) => void;
  /** Lets tests find the gesture with Gesture Handler's `getByGestureTestId`. */
  gestureTestId?: string;
};

export type SwipeAccessibilityProps = {
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
};

export type FullSwipe = {
  /** The sideways pan. Put it in the row's `GestureDetector`, composed with any other gesture it has. */
  gesture: PanGesture;
  /** How far the row is over: 0 at rest, negative to the left. Translate the row by it. */
  translateX: SharedValue<number>;
  /** Whether letting go right now would commit an action. */
  armed: SharedValue<boolean>;
  /** The row's width, which the line and the sweep are measured against. */
  width: SharedValue<number>;
  /** Hand to the row's outer view, the one the backdrop fills. */
  onLayout: (event: LayoutChangeEvent) => void;
  /** Commits a side's action as a completed swipe would: for a button, a menu or a screen reader. */
  trigger: (side: SwipeSide) => void;
  /** Springs the row back to rest. */
  reset: () => void;
  /**
   * The actions as screen-reader actions. Spread onto the row's focusable
   * element, so whoever cannot swipe can still reach them.
   */
  accessibilityProps: SwipeAccessibilityProps;
  left?: SwipeAction;
  right?: SwipeAction;
  threshold: number;
};

const DEFAULT_SPRING: WithSpringConfig = { damping: 18, stiffness: 240, mass: 0.6 };

const ACTION_NAME: Record<SwipeSide, string> = { left: 'fullSwipeLeft', right: 'fullSwipeRight' };

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * The swipe itself: the gesture, where it has the row, and what letting go
 * does. There is no resting place in between. Let go past the line and the
 * side's action is committed; let go short of it and the row springs back.
 *
 * Use it with {@link FullSwipeBackdrop} when the row has gestures or
 * transforms of its own; otherwise {@link SwipeRow} puts the two together.
 */
export function useFullSwipe({
  left,
  right,
  enabled = true,
  threshold = 0.4,
  flickVelocity = 1200,
  flickThreshold = 0.2,
  sweepDuration = 180,
  springConfig = DEFAULT_SPRING,
  activeOffsetX = 14,
  failOffsetY = 12,
  onArmedChange,
  gestureTestId,
}: FullSwipeOptions): FullSwipe {
  const translateX = useSharedValue(0);
  const width = useSharedValue(0);
  /** Set once the row is on its way out, so a late finger cannot pull it back. */
  const sweeping = useSharedValue(false);
  /** Which side of the line the finger last had the row on, for `onArmedChange`. */
  const fingerArmed = useSharedValue(false);

  // The actions and callbacks are read through refs, so inline objects and
  // arrows do not rebuild the gesture on every render.
  const actionsRef = useRef({ left, right });
  actionsRef.current = { left, right };
  const onArmedChangeRef = useRef(onArmedChange);
  onArmedChangeRef.current = onArmedChange;

  // What the worklets need to know about the actions, as plain values.
  const hasLeft = left !== undefined;
  const hasRight = right !== undefined;
  const leftRemoves = (left?.after ?? 'remove') === 'remove';
  const rightRemoves = (right?.after ?? 'remove') === 'remove';

  const armed = useDerivedValue(
    () => width.value > 0 && Math.abs(translateX.value) > width.value * threshold,
  );

  const notifyArmed = useCallback((now: boolean, sign: number) => {
    onArmedChangeRef.current?.(now, sign < 0 ? 'left' : 'right');
  }, []);

  const restore = useCallback(() => {
    translateX.value = withSpring(0, springConfig, (finished) => {
      'worklet';
      if (finished) sweeping.value = false;
    });
    // Shared values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springConfig]);

  /** Runs a side's action; a removal that is refused brings the row back. */
  const run = useCallback(
    (sign: number) => {
      const action = sign < 0 ? actionsRef.current.left : actionsRef.current.right;
      if (!action) return;
      const removes = (action.after ?? 'remove') === 'remove';
      let result: ActionResult;
      try {
        result = action.onAction();
      } catch (error) {
        if (removes) restore();
        throw error;
      }
      if (!removes) return;
      if (result === false) {
        restore();
      } else if (isThenable(result)) {
        result.then(
          (kept) => {
            if (kept === false) restore();
          },
          () => restore(),
        );
      }
    },
    [restore],
  );

  const commit = useCallback(
    (sign: number) => {
      'worklet';
      const removes = sign < 0 ? leftRemoves : rightRemoves;
      if (removes) {
        sweeping.value = true;
        translateX.value = withTiming(sign * width.value, { duration: sweepDuration }, (finished) => {
          'worklet';
          if (finished) runOnJS(run)(sign);
        });
      } else {
        runOnJS(run)(sign);
        translateX.value = withSpring(0, springConfig);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leftRemoves, rightRemoves, sweepDuration, springConfig, run],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled && (hasLeft || hasRight))
      .activeOffsetX([-activeOffsetX, activeOffsetX])
      .failOffsetY([-failOffsetY, failOffsetY])
      .onBegin(() => {
        'worklet';
        fingerArmed.value = false;
      })
      .onUpdate((event) => {
        'worklet';
        if (sweeping.value) return;
        // Only towards a side that has an action.
        let x = event.translationX;
        if (x < 0 && !hasLeft) x = 0;
        if (x > 0 && !hasRight) x = 0;
        translateX.value = x;
        // Told from the finger itself rather than from `armed`, so it lands on the
        // very move that crosses the line, and a sweep or a spring back never trips it.
        const now = width.value > 0 && Math.abs(x) > width.value * threshold;
        if (now !== fingerArmed.value) {
          fingerArmed.value = now;
          runOnJS(notifyArmed)(now, x < 0 ? -1 : 1);
        }
      })
      .onEnd((event) => {
        'worklet';
        if (sweeping.value) return;
        const x = translateX.value;
        if (x === 0) return;
        const sign = x < 0 ? -1 : 1;
        const over = Math.abs(x);
        // Worked out from the row rather than read off `armed`, which is derived
        // and can still be a frame behind when the last move and the lift arrive together.
        const past = width.value > 0 && over > width.value * threshold;
        const flicked = sign * event.velocityX > flickVelocity && over > width.value * flickThreshold;
        if (past || flicked) {
          commit(sign);
        } else {
          translateX.value = withSpring(0, { ...springConfig, velocity: event.velocityX });
        }
      });
    return gestureTestId ? pan.withTestId(gestureTestId) : pan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    hasLeft,
    hasRight,
    activeOffsetX,
    failOffsetY,
    threshold,
    flickVelocity,
    flickThreshold,
    springConfig,
    commit,
    notifyArmed,
    gestureTestId,
  ]);

  const trigger = useCallback(
    (side: SwipeSide) => {
      if (sweeping.value) return;
      if (!actionsRef.current[side]) return;
      runOnUI(commit)(side === 'left' ? -1 : 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  );

  const reset = useCallback(() => {
    sweeping.value = false;
    translateX.value = withSpring(0, springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springConfig]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leftName = left?.accessibilityLabel ?? left?.label;
  const rightName = right?.accessibilityLabel ?? right?.label;
  const accessibilityProps = useMemo<SwipeAccessibilityProps>(() => {
    const actions: AccessibilityActionInfo[] = [];
    if (hasLeft) actions.push({ name: ACTION_NAME.left, label: leftName ?? 'Swipe left' });
    if (hasRight) actions.push({ name: ACTION_NAME.right, label: rightName ?? 'Swipe right' });
    return {
      accessibilityActions: actions,
      onAccessibilityAction: (event) => {
        const name = event.nativeEvent.actionName;
        if (name === ACTION_NAME.left) trigger('left');
        else if (name === ACTION_NAME.right) trigger('right');
      },
    };
  }, [hasLeft, hasRight, leftName, rightName, trigger]);

  return {
    gesture,
    translateX,
    armed,
    width,
    onLayout,
    trigger,
    reset,
    accessibilityProps,
    left,
    right,
    threshold,
  };
}

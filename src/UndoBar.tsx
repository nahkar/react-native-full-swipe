import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export type UndoBarProps = {
  /** Shown while `true`; fades in and out as it changes. */
  visible: boolean;
  /** What was removed, e.g. "250 ml removed". A string or your own node. */
  message: ReactNode;
  /** Defaults to `"Undo"`. */
  actionLabel?: string;
  onAction: () => void;
  /** Colour of the action. Defaults to `#3266AE`. */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  messageStyle?: StyleProp<TextStyle>;
  actionStyle?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * The line that follows a removal: what went, and a way to bring it back.
 * Pair it with {@link useUndo}.
 *
 * It is a polite live region, so a screen reader announces the removal without
 * taking focus away from the list.
 */
export function UndoBar({
  visible,
  message,
  actionLabel = 'Undo',
  onAction,
  accentColor = '#3266AE',
  style,
  messageStyle,
  actionStyle,
  testID,
}: UndoBarProps) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(160)}
      accessibilityLiveRegion="polite"
      style={[styles.bar, style]}
      testID={testID}
    >
      {typeof message === 'string' || typeof message === 'number' ? (
        <Text style={[styles.message, messageStyle]}>{message}</Text>
      ) : (
        message
      )}
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
        <Text style={[styles.action, { color: accentColor }, actionStyle]}>{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE3EC',
    backgroundColor: '#FFFFFF',
  },
  message: { flex: 1, minWidth: 0, fontSize: 14, color: '#1C2533' },
  action: { fontSize: 14, fontWeight: '600' },
});

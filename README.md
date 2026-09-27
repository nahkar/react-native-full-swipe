<p align="center">
  <img src="https://raw.githubusercontent.com/nahkar/react-native-full-swipe/main/media/cover.png" alt="react-native-full-swipe: one swipe, any action, on either side" width="100%" />
</p>

# react-native-full-swipe

[![npm](https://img.shields.io/npm/v/react-native-full-swipe.svg)](https://www.npmjs.com/package/react-native-full-swipe)
[![license](https://img.shields.io/npm/l/react-native-full-swipe.svg)](LICENSE)
[![types](https://img.shields.io/npm/types/react-native-full-swipe.svg)](https://www.npmjs.com/package/react-native-full-swipe)
![platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey.svg)

Full-swipe actions for React Native rows. Swipe a row past the line to delete it, archive it, mark it as read, pin it: a different action on each side. Comes with an undo bar for the swipe you didn't mean.

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/nahkar/react-native-full-swipe/main/media/undo.gif" width="200" alt="Swipe left to delete, then undo" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/nahkar/react-native-full-swipe/main/media/sides.gif" width="200" alt="Swipe right to mark as read, left to archive" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/nahkar/react-native-full-swipe/main/media/confirm.gif" width="200" alt="Confirm before deleting" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/nahkar/react-native-full-swipe/main/media/custom.gif" width="200" alt="Custom backdrop content" /></td>
  </tr>
  <tr>
    <td align="center"><b>Delete + undo</b><br/><sub>let go short and it springs back</sub></td>
    <td align="center"><b>Two sides</b><br/><sub>read stays, archive leaves</sub></td>
    <td align="center"><b>Confirm</b><br/><sub>return <code>false</code> to keep the row</sub></td>
    <td align="center"><b>Your own look</b><br/><sub>hook + backdrop</sub></td>
  </tr>
</table>

Most swipeable rows stop halfway and show a few buttons (the iOS Mail pattern). This package does the other pattern, the one Telegram and Gmail use: the row doesn't stop. The action's colour fills the whole gap the row opens, and when you let go, the action either happens or the row springs back.

- **The line is something you feel.** Past it, the icon jumps and `onArmedChange` fires. That's where your haptic goes. Back off, and it jumps back.
- **A flick counts, a twitch doesn't.** A fast flick commits from a shorter swipe, but only once the row is a fair way over.
- **Each side has its own action.** One can remove the row (`after: 'remove'`, e.g. delete or archive). The other can leave it in place (`after: 'reset'`, e.g. mark as read or pin).
- **A removal can be confirmed, or can fail.** Return `false`, a promise of it, or a rejected promise, and the row comes back.
- **Undo is included.** `useUndo` + `UndoBar` hold the last removed item for a few seconds.
- **Screen readers get the actions too.** Every side is also an accessibility action.
- **It runs on the UI thread.** Built on Reanimated and Gesture Handler. No SVG dependency, no styling library.

## Install

```sh
npm install react-native-full-swipe
```

Peer dependencies you most likely already have:

```sh
npx expo install react-native-reanimated react-native-gesture-handler
```

Wrap your app in `GestureHandlerRootView` if you haven't already.

## Quick start

```tsx
import { SwipeRow, TrashIcon } from 'react-native-full-swipe';

<SwipeRow
  left={{ label: 'Delete', icon: <TrashIcon />, onAction: () => remove(item.id) }}
  right={{ label: 'Read', icon: <CheckIcon />, after: 'reset', onAction: () => markRead(item.id) }}
  onArmedChange={(armed) => armed && Haptics.impactAsync()}
>
  <MessageCard item={item} />
</SwipeRow>
```

`left` is the action for swiping the row **to the left**, which uncovers the right-hand side. `right` is the action for swiping it to the right. Give only one of them and the row only moves that way.

The row's content has to be **opaque**, or the colour shows through it. Give `borderRadius` the same corner radius as your rows, so the corners that come out from under a row match it.

### What happens after the swipe

| `after` | The row… | `onAction` runs… | Use for |
|---|---|---|---|
| `'remove'` (default) | slides off the edge and stays there until you take it out of your list | once it is off screen | delete, archive, move to folder |
| `'reset'` | springs back | at once | mark as read, pin, star, snooze |

## Undo

```tsx
import { SwipeRow, TrashIcon, UndoBar, useUndo } from 'react-native-full-swipe';

const undo = useUndo<Drink>({ timeout: 5000 });

{drinks.map((drink) => (
  <SwipeRow
    key={drink.id}
    left={{
      label: 'Delete',
      icon: <TrashIcon />,
      onAction: () => {
        undo.push(drink);
        setDrinks((list) => list.filter((d) => d.id !== drink.id));
      },
    }}
  >
    <DrinkCard drink={drink} />
  </SwipeRow>
))}

<UndoBar
  visible={undo.item !== null}
  message={`${undo.item?.ml} ml removed`}
  onAction={() => {
    const back = undo.take();
    if (back) setDrinks((list) => [back, ...list]);
  }}
/>
```

## Confirming a removal

```tsx
<SwipeRow
  left={{
    label: 'Delete',
    icon: <TrashIcon />,
    onAction: () =>
      new Promise<boolean>((resolve) =>
        Alert.alert('Delete?', undefined, [
          { text: 'Keep', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => { remove(item); resolve(true); } },
        ]),
      ),
  }}
>
```

The same works for a network call: return its promise. If the promise rejects, the row comes back.

## A row with other gestures

`SwipeRow` is two parts put together. Use them directly when the row also has its own gestures (a long press to reorder, say) or its own transforms:

```tsx
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { FullSwipeBackdrop, useFullSwipe } from 'react-native-full-swipe';

function Row({ onDelete, children }) {
  const swipe = useFullSwipe({ left: { label: 'Delete', onAction: onDelete } });
  const { translateX } = swipe; // take it out before using it in a worklet
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View onLayout={swipe.onLayout}>
      <FullSwipeBackdrop swipe={swipe} />
      <GestureDetector gesture={Gesture.Race(swipe.gesture, yourLongPress)}>
        <Animated.View style={style}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
```

Take shared values out of `swipe` before you use them in a worklet. A worklet that reaches through `swipe` would try to copy the gesture object onto the UI thread, and that fails.

## Accessibility

A swipe is a gesture that not everyone can make, so every side is also a screen-reader action, named by its `label`. Pass a function as the child and spread what it gets onto the row's focusable element:

```tsx
<SwipeRow left={{ label: 'Delete', onAction: remove }} right={{ label: 'Read', after: 'reset', onAction: read }}>
  {(a11y) => (
    <Pressable onPress={open} accessibilityLabel={`${item.from}: ${item.text}`} {...a11y}>
      <MessageCard item={item} />
    </Pressable>
  )}
</SwipeRow>
```

With the hook, spread `swipe.accessibilityProps` the same way. `ref.trigger('left')` (or `swipe.trigger`) commits an action from a button or a menu, with the same animation.

The backdrop is hidden from screen readers, because the action happens when you let go, not when you tap the backdrop. `UndoBar` is a polite live region, so the removal is announced without moving focus.

## API

### `SwipeAction`

| Field | | |
|---|---|---|
| `onAction` | required | `() => void \| boolean \| Promise<void \| boolean>` |
| `after` | `'remove'` | `'remove'` or `'reset'`, see above. |
| `label` | | Text under the icon. Also names the accessibility action. |
| `icon` | | Any node. `TrashIcon` is included, or bring your own icon set. |
| `color` | red / blue | Red for `'remove'`, blue for `'reset'`. |
| `labelStyle` | | |
| `content` | | Replaces icon and label. It still grows and jumps with the swipe. |
| `accessibilityLabel` | `label` | |

### `useFullSwipe(options)`

| Option | Default | |
|---|---|---|
| `left`, `right` | | `SwipeAction`s. |
| `enabled` | `true` | |
| `threshold` | `0.4` | Share of the row's width past which letting go commits. |
| `flickVelocity` | `1200` | Points per second for a flick to count. |
| `flickThreshold` | `0.2` | Share of the width the row must be over for a flick to count. |
| `sweepDuration` | `180` | ms the row takes to leave. |
| `springConfig` | `{ damping: 18, stiffness: 240, mass: 0.6 }` | The spring back. |
| `activeOffsetX` | `14` | Sideways travel before the swipe takes over. |
| `failOffsetY` | `12` | Vertical travel before it gives up, so the list still scrolls. |
| `onArmedChange` | | `(armed, side) => void` on the JS thread when the finger crosses the line. |
| `gestureTestId` | | For Gesture Handler's `getByGestureTestId` in tests. |

Returns `{ gesture, translateX, armed, width, onLayout, trigger(side), reset(), accessibilityProps, left, right, threshold }`.

### `<FullSwipeBackdrop swipe borderRadius style>`

Draws each side's colour, icon and label behind the row.

### `<SwipeRow>`

All hook options, plus `borderRadius`, `style` (outer view), `rowStyle` (sliding view), `backdropStyle`, `testID`, and a `ref` with `trigger(side)` / `reset()`. `children` can be a node or `(accessibilityProps) => node`.

### `useUndo<T>({ timeout = 5000 })`

Returns `{ item, push(item), take(), clear() }`. Pushing again restarts the countdown, even for an equal item. `take()` returns the held item once and stops holding it.

### `<UndoBar visible message actionLabel onAction accentColor style messageStyle actionStyle>`

Fades in and out with `visible`. `message` can be a string or your own node.

## Testing

Pass `gestureTestId` and drive the gesture with Gesture Handler's jest utils:

```tsx
fireGestureHandler(getByGestureTestId('swipe'), [
  { state: State.BEGAN, translationX: 0 },
  { state: State.ACTIVE, translationX: -20 },   // the first ACTIVE event starts the gesture
  { state: State.ACTIVE, translationX: -200 },
  { state: State.END, translationX: -200 },
]);
jest.advanceTimersByTime(1000);                 // let the sweep finish
```

The row needs a width for the threshold to mean anything, so fire `layout` on it first.

## License

MIT

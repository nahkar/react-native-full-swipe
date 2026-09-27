import { createRef } from 'react';
import { Pressable, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SwipeRow, type SwipeRowHandle, type SwipeRowProps } from '../SwipeRow';

const WIDTH = 300;

async function renderRow(props: Partial<SwipeRowProps> = {}) {
  const ref = createRef<SwipeRowHandle>();
  await render(
    <SwipeRow ref={ref} testID="row" gestureTestId="swipe" {...props}>
      {props.children ?? <Text>Water · 250 ml</Text>}
    </SwipeRow>,
  );
  await fireEvent(screen.getByTestId('row'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } },
  });
  return { ref };
}

/** Drags the row sideways by `dx` (negative is left) and lets go at `velocityX`. */
async function swipe(dx: number, velocityX = 0) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('swipe'), [
      { state: State.BEGAN, translationX: 0, velocityX: 0 },
      // The first ACTIVE event starts the gesture; updates come after it.
      { state: State.ACTIVE, translationX: dx / 2, velocityX },
      { state: State.ACTIVE, translationX: dx, velocityX },
      { state: State.END, translationX: dx, velocityX },
    ]);
  });
}

/** Lets the sweep or the spring back play out. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a side that removes', () => {
  it('commits when let go past the line', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.5);
    await settle();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('springs back when let go short of it', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.3);
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('commits from a shorter swipe when flicked', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.25, -2000);
    await settle();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('ignores a flick that barely moved the row', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.1, -2000);
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores a flick the other way', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.25, 2000);
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('can be swiped again after onAction answers false', async () => {
    const onAction = jest.fn(() => false);
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.5);
    await settle();
    await swipe(-WIDTH * 0.5);
    await settle();
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('can be swiped again after onAction rejects', async () => {
    const onAction = jest.fn(() => Promise.reject(new Error('offline')));
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.5);
    await settle();
    await act(async () => {});
    await settle();
    await swipe(-WIDTH * 0.5);
    await settle();
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('is not committed twice once it is on its way out', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.5);
    await swipe(-WIDTH * 0.5);
    await settle();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('a side that resets', () => {
  it('commits and can be swiped again straight away', async () => {
    const onAction = jest.fn();
    await renderRow({ right: { label: 'Read', after: 'reset', onAction } });
    await swipe(WIDTH * 0.5);
    await swipe(WIDTH * 0.5);
    await settle();
    expect(onAction).toHaveBeenCalledTimes(2);
  });
});

describe('two sides', () => {
  it('runs the action for the way the row was swiped', async () => {
    const remove = jest.fn();
    const read = jest.fn();
    await renderRow({
      left: { label: 'Delete', onAction: remove },
      right: { label: 'Read', after: 'reset', onAction: read },
    });
    await swipe(WIDTH * 0.5);
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();

    await swipe(-WIDTH * 0.5);
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not move towards a side without an action', async () => {
    const onAction = jest.fn();
    await renderRow({ left: { label: 'Delete', onAction } });
    await swipe(WIDTH * 0.8, 2000);
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('options', () => {
  it('honours a custom threshold', async () => {
    const onAction = jest.fn();
    await renderRow({ threshold: 0.6, left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.5);
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('stands still when disabled', async () => {
    const onAction = jest.fn();
    await renderRow({ enabled: false, left: { label: 'Delete', onAction } });
    await swipe(-WIDTH * 0.9);
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('onArmedChange', () => {
  it('tells when the finger crosses the line, and on which side', async () => {
    const onArmedChange = jest.fn();
    await renderRow({
      onArmedChange,
      left: { label: 'Delete', onAction: jest.fn() },
      right: { label: 'Read', after: 'reset', onAction: jest.fn() },
    });
    await swipe(-WIDTH * 0.3);
    await settle();
    expect(onArmedChange).not.toHaveBeenCalled();

    await swipe(WIDTH * 0.5);
    await settle();
    expect(onArmedChange.mock.calls).toEqual([[true, 'right']]);
  });

  it('tells when the finger backs off the line again', async () => {
    const onArmedChange = jest.fn();
    const onAction = jest.fn();
    await renderRow({ onArmedChange, left: { label: 'Delete', onAction } });
    await act(async () => {
      fireGestureHandler(getByGestureTestId('swipe'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: -20 },
        { state: State.ACTIVE, translationX: -WIDTH * 0.5 },
        { state: State.ACTIVE, translationX: -WIDTH * 0.2 },
        { state: State.END, translationX: -WIDTH * 0.2 },
      ]);
    });
    await settle();
    expect(onArmedChange.mock.calls).toEqual([
      [true, 'left'],
      [false, 'left'],
    ]);
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('without swiping', () => {
  it('commits through the ref', async () => {
    const onAction = jest.fn();
    const { ref } = await renderRow({ left: { label: 'Delete', onAction } });
    await act(async () => ref.current?.trigger('left'));
    await settle();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('ignores a ref trigger for a side without an action', async () => {
    const onAction = jest.fn();
    const { ref } = await renderRow({ left: { label: 'Delete', onAction } });
    await act(async () => ref.current?.trigger('right'));
    await settle();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('offers each side as a screen-reader action on the focusable element', async () => {
    const remove = jest.fn();
    const read = jest.fn();
    await renderRow({
      left: { label: 'Delete', onAction: remove },
      right: { label: 'Read', after: 'reset', onAction: read },
      children: (a11y) => (
        <Pressable testID="focusable" accessibilityLabel="Water, 250 ml" {...a11y}>
          <Text>Water · 250 ml</Text>
        </Pressable>
      ),
    });
    const focusable = screen.getByTestId('focusable');
    expect(focusable.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
      'Delete',
      'Read',
    ]);

    await fireEvent(focusable, 'accessibilityAction', {
      nativeEvent: { actionName: 'fullSwipeRight' },
    });
    await settle();
    expect(read).toHaveBeenCalledTimes(1);

    await fireEvent(focusable, 'accessibilityAction', {
      nativeEvent: { actionName: 'fullSwipeLeft' },
    });
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the backdrop away from screen readers', async () => {
    await renderRow({ left: { label: 'Delete', onAction: jest.fn() } });
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.getByText('Water · 250 ml')).toBeTruthy();
  });
});

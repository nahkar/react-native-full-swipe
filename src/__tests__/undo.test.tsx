import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { UndoBar } from '../UndoBar';
import { useUndo } from '../useUndo';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useUndo', () => {
  it('holds a pushed item until the timeout', async () => {
    const { result } = await renderHook(() => useUndo<string>({ timeout: 5000 }));
    await act(async () => result.current.push('water'));
    expect(result.current.item).toBe('water');

    await act(async () => jest.advanceTimersByTime(4999));
    expect(result.current.item).toBe('water');

    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current.item).toBeNull();
  });

  it('restarts the countdown when pushed again, even with the same item', async () => {
    const { result } = await renderHook(() => useUndo<string>({ timeout: 5000 }));
    await act(async () => result.current.push('water'));
    await act(async () => jest.advanceTimersByTime(4000));
    await act(async () => result.current.push('water'));
    await act(async () => jest.advanceTimersByTime(4000));
    expect(result.current.item).toBe('water');
  });

  it('hands the item back once from take', async () => {
    const { result } = await renderHook(() => useUndo<string>());
    await act(async () => result.current.push('tea'));

    let taken: string | null = null;
    let again: string | null = 'unset';
    await act(async () => {
      taken = result.current.take();
      again = result.current.take();
    });
    expect(taken).toBe('tea');
    expect(again).toBeNull();
    expect(result.current.item).toBeNull();
  });

  it('drops the item on clear', async () => {
    const { result } = await renderHook(() => useUndo<string>());
    await act(async () => result.current.push('tea'));
    await act(async () => result.current.clear());
    expect(result.current.item).toBeNull();
  });
});

describe('UndoBar', () => {
  it('shows the message and calls back from its action', async () => {
    const onAction = jest.fn();
    await render(<UndoBar visible message="250 ml removed" actionLabel="Undo" onAction={onAction} />);
    expect(screen.getByText('250 ml removed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', async () => {
    await render(<UndoBar visible={false} message="250 ml removed" onAction={() => {}} />);
    expect(screen.queryByText('250 ml removed')).toBeNull();
  });
});

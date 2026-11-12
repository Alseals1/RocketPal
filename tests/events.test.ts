import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createEventBus, type GameEvent } from '../src/core/events';

let error: MockInstance<typeof console.error>;
beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => error.mockRestore());

describe('createEventBus', () => {
  it('calls the handlers for that type only, in the order they subscribed', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    bus.on('dotFound', () => calls.push('a'));
    bus.on('arrived', () => calls.push('arrived'));
    bus.on('dotFound', () => calls.push('b'));
    bus.emit({ type: 'dotFound', dot: 'mars/rim' });
    expect(calls).toEqual(['a', 'b']);
  });

  it('hands each handler the event, narrowed to its type', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.on('quizFinished', (e) => seen.push(`${e.place}:${e.firstTryAll}`)); // e.place only exists on quizFinished
    bus.emit({ type: 'quizFinished', place: 'mars', firstTryAll: true });
    expect(seen).toEqual(['mars:true']);
  });

  it('an emit with no handlers does nothing', () => {
    expect(() => createEventBus().emit({ type: 'bump' })).not.toThrow();
  });

  it('unsubscribe stops one handler and leaves the rest', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    const off = bus.on('bump', () => calls.push('a'));
    bus.on('bump', () => calls.push('b'));
    off();
    off(); // twice is harmless
    bus.emit({ type: 'bump' });
    expect(calls).toEqual(['b']);
  });

  it('the same function subscribed twice runs twice, and each unsubscribe removes one', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const off1 = bus.on('bump', fn);
    bus.on('bump', fn);
    bus.emit({ type: 'bump' });
    expect(fn).toHaveBeenCalledTimes(2);
    off1();
    bus.emit({ type: 'bump' });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('subscribing or unsubscribing during an emit changes only the next emit', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    let offB = () => {};
    bus.on('bump', () => {
      calls.push('a');
      offB();
      bus.on('bump', () => calls.push('late'));
    });
    offB = bus.on('bump', () => calls.push('b'));
    bus.emit({ type: 'bump' });
    expect(calls).toEqual(['a', 'b']);
    calls.length = 0;
    bus.emit({ type: 'bump' });
    expect(calls).toEqual(['a', 'late']);
  });

  it('a handler that throws is logged and the others still run', () => {
    const bus = createEventBus();
    const after = vi.fn();
    const boom = new Error('boom');
    bus.on('boost', () => {
      throw boom;
    });
    bus.on('boost', after);
    const e: GameEvent = { type: 'boost', on: true };
    bus.emit(e);
    expect(after).toHaveBeenCalledWith(e);
    expect(error).toHaveBeenCalledWith(boom);
  });
});

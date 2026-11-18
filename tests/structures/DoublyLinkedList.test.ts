import { describe, expect, it } from 'vitest';
import { DoublyLinkedList } from '../../src/structures/DoublyLinkedList';

describe('DoublyLinkedList', () => {
  it('builds forward and backward views', () => {
    const l = DoublyLinkedList.from([1, 2, 3]);
    l.prepend(0);
    expect(l.toArray()).toEqual([0, 1, 2, 3]);
    expect(l.toArrayReversed()).toEqual([3, 2, 1, 0]);
  });

  it('navigates with a cursor', () => {
    const l = DoublyLinkedList.from(['a', 'b', 'c']);
    expect(l.moveTo((x) => x === 'b')).toBe('b');
    expect(l.peekPrevious()).toBe('a');
    expect(l.peekNext()).toBe('c');
    expect(l.next()).toBe('c');
    expect(l.hasNext()).toBe(false);
    expect(l.next()).toBe('c');
    expect(l.previous()).toBe('b');
    expect(l.previous()).toBe('a');
    expect(l.hasPrevious()).toBe(false);
  });

  it('moveTo returns undefined when missing', () => {
    const l = DoublyLinkedList.from([1]);
    expect(l.moveTo((x) => x === 5)).toBeUndefined();
    expect(l.currentValue).toBeUndefined();
  });

  it('removes nodes and relinks neighbours', () => {
    const l = new DoublyLinkedList<number>();
    const a = l.append(1);
    const b = l.append(2);
    l.append(3);
    l.removeNode(b);
    expect(l.toArray()).toEqual([1, 3]);
    l.removeNode(a);
    expect(l.toArrayReversed()).toEqual([3]);
    expect(l.size).toBe(1);
  });
});

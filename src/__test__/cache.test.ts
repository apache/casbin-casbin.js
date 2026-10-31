import * as Cache from '../Cache';

describe('permission cache', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('saves and expires an entry', () => {
        expect(Cache.saveToLocalStorage('test', 'value', 1)).toBe(0);
        expect(Cache.loadFromLocalStorage('test')).toBe('value');
        expect(localStorage.getItem('casbinjs_test')).not.toBeNull();

        jest.advanceTimersByTime(1001);

        expect(Cache.loadFromLocalStorage('test')).toBeNull();
        expect(localStorage.getItem('casbinjs_test')).toBeNull();
    });

    test('ignores and removes a corrupted entry', () => {
        localStorage.setItem('casbinjs_bad', '{not json');
        expect(Cache.loadFromLocalStorage('bad')).toBeNull();
        expect(localStorage.getItem('casbinjs_bad')).toBeNull();
    });

    test('ignores and removes an entry with an unexpected shape', () => {
        localStorage.setItem('casbinjs_bad', JSON.stringify({ value: 42 }));
        expect(Cache.loadFromLocalStorage('bad')).toBeNull();
        expect(localStorage.getItem('casbinjs_bad')).toBeNull();
    });

    test('removes an entry', () => {
        Cache.saveToLocalStorage('test', 'value', 60);
        Cache.removeLocalStorage('test');
        expect(localStorage.getItem('casbinjs_test')).toBeNull();
    });
});

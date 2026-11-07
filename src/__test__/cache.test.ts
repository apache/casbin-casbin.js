/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

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

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

test('importing the library works when the browser denies access to localStorage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
            throw new DOMException('Storage denied', 'SecurityError');
        },
    });
    try {
        jest.isolateModules(() => {
            const cache = jest.requireActual<typeof import('../Cache')>('../Cache');
            expect(cache.loadFromLocalStorage('alice')).toBeNull();
            expect(cache.saveToLocalStorage('alice', '{}', 60)).toBe(-1);
        });
    } finally {
        Object.defineProperty(window, 'localStorage', descriptor);
    }
});

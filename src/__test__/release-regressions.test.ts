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

import Cookies from 'js-cookie';
import { Authorizer } from '../Authorizer';
import { basicModelStr, rbacModelStr } from './models';

const permission = (object: string) => ({ m: basicModelStr, p: [['p', 'alice', object, 'read']] });

test('an older request for the same user cannot replace a newer permission or cache', async () => {
    localStorage.clear();
    const endpoint = 'https://casbin.test/request-order';
    const authorizer = new Authorizer('auto', { endpoint });
    let resolveOld!: (value: ReturnType<typeof permission>) => void;
    authorizer.getEnforcerDataFromSvr = () =>
        new Promise((resolve) => {
            resolveOld = resolve;
        });
    const oldLoad = authorizer.setUser('alice');
    authorizer.getEnforcerDataFromSvr = () => Promise.resolve(permission('new-data'));
    await authorizer.refresh();
    resolveOld(permission('old-data'));
    await oldLoad;
    expect(await authorizer.can('read', 'new-data')).toBe(true);
    expect(await authorizer.can('read', 'old-data')).toBe(false);
    const cached = new Authorizer('auto', { endpoint });
    cached.getEnforcerDataFromSvr = () => Promise.reject(new Error('expected the new cache'));
    await cached.setUser('alice');
    expect(await cached.can('read', 'new-data')).toBe(true);
    expect(await cached.can('read', 'old-data')).toBe(false);
});

test.each(['map', 'model'])('removing a %s permission cookie clears the previous permission', async (shape) => {
    const data =
        shape === 'map'
            ? { read: ['data1'] }
            : {
                  m: rbacModelStr,
                  p: [['p', 'admin', 'data1', 'read']],
                  g: [['g', 'alice', 'admin']],
              };
    Cookies.set('access_perm', JSON.stringify(data));
    const authorizer = new Authorizer('cookies');
    await authorizer.setUser('alice');
    expect(await authorizer.can('read', 'data1')).toBe(true);
    Cookies.remove('access_perm');
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
        expect(authorizer.loadPermissionFromCookie()).toBe(false);
        expect(await authorizer.can('read', 'data1')).toBe(false);
    } finally {
        warning.mockRestore();
    }
});

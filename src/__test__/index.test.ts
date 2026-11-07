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

import { Authorizer } from '../index';
import { basicModelStr } from './models';
import { basicPolicies } from './policies';
import TestServer from './server';

async function check(authorizer: Authorizer) {
    // can
    expect(await authorizer.can('read', 'data1')).toBe(true);
    expect(await authorizer.can('read', 'data4')).toBe(false);
    expect(await authorizer.can('write', 'data1')).toBe(false);
    // cannot
    expect(await authorizer.cannot('read', 'data4')).toBe(true);
    expect(await authorizer.cannot('read', 'data1')).toBe(false);
    // canAll
    expect(await authorizer.canAll('read', ['data1', 'data2'])).toBe(true);
    expect(await authorizer.canAll('write', ['data1', 'data2'])).toBe(false);
    expect(await authorizer.canAll('read', ['data1', 'data2', 'data4'])).toBe(false);
    // canAny
    expect(await authorizer.canAny('read', ['data1', 'data2'])).toBe(true);
    expect(await authorizer.canAny('write', ['data1', 'data2'])).toBe(true);
    expect(await authorizer.canAny('read', ['data1', 'data2', 'data4'])).toBe(true);
    expect(await authorizer.canAny('read', ['data4'])).toBe(false);
}

const permissionObj = {
    read: ['data1', 'data2'],
    write: ['data2'],
};

test('Manual mode', async () => {
    const authorizer = new Authorizer('manual');
    authorizer.setPermission(permissionObj);
    await check(authorizer);
    expect(authorizer.getPermission()).toEqual(permissionObj);
});

test('Auto mode', async () => {
    const respData = JSON.stringify({
        m: basicModelStr,
        p: basicPolicies,
    });
    const authorizer = new Authorizer('auto', { endpoint: 'whatever' });
    await authorizer.initEnforcer(respData);
    authorizer.user = 'alice';
    await check(authorizer);
});

describe('Auto mode with server', () => {
    let server: TestServer;

    beforeAll(async () => {
        server = new TestServer();
        await server.start();
    });

    afterAll(() => server.terminate());

    test('Request for /api/permissions', async () => {
        const endpoint = `http://localhost:${server.port}/api/permissions`;
        const authorizer = new Authorizer('auto', { endpoint });
        await authorizer.setUser('alice');
        await check(authorizer);
        // The permission is cached for the next authorizer of the same endpoint and user.
        expect(localStorage.getItem(`casbinjs_${endpoint}::alice`)).not.toBeNull();
    });
});

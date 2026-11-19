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

import Permission from '../Permission';

describe('Permission unit test', () => {
    const permExample = {
        read: ['data1', 'data2'],
        write: ['data2'],
    };
    const permission = new Permission();

    test('Load permission from JSON object', () => {
        permission.load(permExample);
        const t = permission.getPermissionJsonObject();
        expect(t).toMatchObject(permExample);
    });

    test('Load permission from JSON string', () => {
        const s = JSON.stringify(permExample);
        permission.load(s);
        const t = permission.getPermissionString();
        expect(JSON.parse(t)).toMatchObject(permExample);
    });

    test('Get targets from an action', () => {
        permission.load(permExample);

        let expected = permExample['read'];
        let actual = permission.getTargetsFromAction('read');
        expect(actual.sort()).toEqual(expected.sort());

        expected = permExample['write'];
        actual = permission.getTargetsFromAction('write');
        expect(actual.sort()).toEqual(expected.sort());
    });

    test('Get action-object mapping', () => {
        permission.load(permExample);
        const actual = permission.getActionsObjects();
        expect(actual.get('read')).toEqual(['data1', 'data2']);
        expect(actual.get('write')).toEqual(['data2']);
    });

    test('Get object-action mapping', () => {
        permission.load(permExample);
        const actual = permission.getObjectsActions();
        expect(actual.get('data1')).toEqual(['read']);
        expect(actual.get('data2')).toEqual(['read', 'write']);
    });

    test('Reject a permission that does not map actions to arrays', () => {
        expect(() => permission.load({ read: 'data1' } as any)).toThrow(/must be an array of objects/);
        expect(() => permission.load('[]')).toThrow(/must be a JSON object/);
    });

    test('An action named "__proto__" stays an own property', () => {
        permission.load(JSON.parse('{"__proto__": ["data1"]}'));

        const actual = permission.getPermissionJsonObject();
        expect(Object.prototype.hasOwnProperty.call(actual, '__proto__')).toBe(true);
        expect(actual['__proto__']).toEqual(['data1']);
        expect(({} as any).data1).toBeUndefined();
    });

    test('The returned permission does not share its arrays with the internal state', () => {
        permission.load(permExample);
        permission.getPermissionJsonObject()['read'].push('data3');

        expect(permission.check('read', 'data3')).toBe(false);
    });
});

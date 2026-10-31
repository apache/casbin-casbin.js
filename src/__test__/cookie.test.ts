import Cookies from 'js-cookie';
import { Authorizer } from '../Authorizer';
import { rbacModelStr } from './models';

describe('cookies mode', () => {
    afterEach(() => {
        Cookies.remove('access_perm');
        Cookies.remove('custom_perm');
    });

    test('loads the permission from the default cookie', async () => {
        Cookies.set('access_perm', JSON.stringify({ read: ['data1'] }));

        const authorizer = new Authorizer('cookies');

        expect(authorizer.cookieKey).toBe('access_perm');
        expect(await authorizer.can('read', 'data1')).toBe(true);
        expect(await authorizer.can('read', 'data2')).toBe(false);
        expect(authorizer.getPermission()).toEqual({ read: ['data1'] });
    });

    test('loads the permission from a custom cookie key', async () => {
        Cookies.set('custom_perm', JSON.stringify({ write: ['data2'] }));

        const authorizer = new Authorizer('cookies', { cookieKey: 'custom_perm' });

        expect(await authorizer.can('write', 'data2')).toBe(true);
        expect(await authorizer.can('write', 'data1')).toBe(false);
    });

    test('reloads the permission when the cookie changes', async () => {
        Cookies.set('access_perm', JSON.stringify({ read: ['data1'] }));
        const authorizer = new Authorizer('cookies');

        Cookies.set('access_perm', JSON.stringify({ read: ['data2'] }));
        expect(authorizer.loadPermissionFromCookie()).toBe(true);

        expect(await authorizer.can('read', 'data2')).toBe(true);
        expect(await authorizer.can('read', 'data1')).toBe(false);
    });

    test('supports the model and policies of CasbinJsGetPermissionForUser', async () => {
        Cookies.set(
            'access_perm',
            JSON.stringify({
                m: rbacModelStr,
                p: [['p', 'admin', 'data1', 'read']],
                g: [['g', 'alice', 'admin']],
            }),
        );

        const authorizer = new Authorizer('cookies');
        await authorizer.setUser('alice');

        expect(await authorizer.can('read', 'data1')).toBe(true);
        expect(await authorizer.can('write', 'data1')).toBe(false);
        expect(await authorizer.getRoles()).toEqual(['admin']);
    });

    test('reports a missing cookie', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        const authorizer = new Authorizer('cookies');

        expect(warn).toHaveBeenCalled();
        expect(await authorizer.can('read', 'data1')).toBe(false);
        warn.mockRestore();
    });

    test('rejects a malformed cookie', () => {
        Cookies.set('access_perm', '{not json');
        expect(() => new Authorizer('cookies')).toThrow(/does not contain a valid permission/);
    });
});

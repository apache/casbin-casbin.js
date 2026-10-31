import { Authorizer } from '../Authorizer';
import { basicModelStr } from './models';

function permissionOf(user: string, object: string): string {
    return JSON.stringify({
        m: basicModelStr,
        p: [['p', user, object, 'read']],
    });
}

test('can waits for the permission that setUser is still loading', async () => {
    const authorizer = new Authorizer('auto', { endpoint: 'http://casbin.test/in-flight' });
    authorizer.getEnforcerDataFromSvr = () => Promise.resolve(permissionOf('alice', 'data1'));

    const loading = authorizer.setUser('alice');
    // No await on "loading" here, "can" has to wait for it by itself.
    expect(await authorizer.can('read', 'data1')).toBe(true);
    await loading;
});

test('a slow load for a former user does not overwrite the current one', async () => {
    const authorizer = new Authorizer('auto', { endpoint: 'http://casbin.test/switch' });
    let releaseAlice: () => void = () => undefined;
    const aliceLoading = new Promise<void>((resolve) => (releaseAlice = resolve));
    authorizer.getEnforcerDataFromSvr = async () => {
        if (authorizer.user === 'alice') {
            await aliceLoading;
            return permissionOf('alice', 'alice-data');
        }
        return permissionOf('bob', 'bob-data');
    };

    const alice = authorizer.setUser('alice');
    const bob = authorizer.setUser('bob');
    await bob;
    releaseAlice();
    await alice;

    expect(authorizer.user).toBe('bob');
    expect(await authorizer.can('read', 'bob-data')).toBe(true);
    expect(await authorizer.can('read', 'alice-data')).toBe(false);
});

test('the cache of an endpoint is not shared with another endpoint', async () => {
    const first = new Authorizer('auto', { endpoint: 'http://casbin.test/first' });
    first.getEnforcerDataFromSvr = () => Promise.resolve(permissionOf('alice', 'data1'));
    await first.setUser('alice');
    expect(await first.can('read', 'data1')).toBe(true);

    const second = new Authorizer('auto', { endpoint: 'http://casbin.test/second' });
    second.getEnforcerDataFromSvr = () => Promise.resolve(permissionOf('alice', 'data2'));
    await second.setUser('alice');

    expect(await second.can('read', 'data2')).toBe(true);
    expect(await second.can('read', 'data1')).toBe(false);
});

test('refresh ignores and updates the cached permission', async () => {
    const authorizer = new Authorizer('auto', { endpoint: 'http://casbin.test/refresh', cacheExpiredTime: 3600 });
    let calls = 0;
    authorizer.getEnforcerDataFromSvr = () => {
        calls++;
        return Promise.resolve(permissionOf('alice', calls === 1 ? 'data1' : 'data2'));
    };

    await authorizer.setUser('alice');
    expect(calls).toBe(1);
    expect(await authorizer.can('read', 'data1')).toBe(true);

    await authorizer.refresh();
    expect(calls).toBe(2);
    expect(await authorizer.can('read', 'data2')).toBe(true);
    expect(await authorizer.can('read', 'data1')).toBe(false);
});

test('a second authorizer of the same endpoint and user uses the cache', async () => {
    const endpoint = 'http://casbin.test/cached';
    const first = new Authorizer('auto', { endpoint, cacheExpiredTime: 3600 });
    let calls = 0;
    first.getEnforcerDataFromSvr = () => {
        calls++;
        return Promise.resolve(permissionOf('alice', 'data1'));
    };
    await first.setUser('alice');

    const second = new Authorizer('auto', { endpoint, cacheExpiredTime: 3600 });
    second.getEnforcerDataFromSvr = () => {
        calls++;
        return Promise.resolve(permissionOf('alice', 'data2'));
    };
    await second.setUser('alice');

    expect(calls).toBe(1);
    expect(await second.can('read', 'data1')).toBe(true);
});

test('clearCache removes the entry of the current user', async () => {
    const endpoint = 'http://casbin.test/clear';
    let calls = 0;
    const load = () => {
        calls++;
        return Promise.resolve(permissionOf('alice', 'data1'));
    };

    const authorizer = new Authorizer('auto', { endpoint, cacheExpiredTime: 3600 });
    authorizer.getEnforcerDataFromSvr = load;
    await authorizer.setUser('alice');
    authorizer.clearCache();

    const second = new Authorizer('auto', { endpoint, cacheExpiredTime: 3600 });
    second.getEnforcerDataFromSvr = load;
    await second.setUser('alice');

    expect(calls).toBe(2);
});

test('refresh is rejected outside auto mode', async () => {
    const authorizer = new Authorizer('manual');
    await expect(authorizer.refresh()).rejects.toThrow(/only available in auto mode/);
});

test('setUser retries after a failed load', async () => {
    const authorizer = new Authorizer('auto', { endpoint: 'http://casbin.test/retry' });
    let attempts = 0;
    authorizer.getEnforcerDataFromSvr = () => {
        attempts++;
        if (attempts === 1) {
            return Promise.reject(new Error('network down'));
        }
        return Promise.resolve(permissionOf('alice', 'data1'));
    };

    await expect(authorizer.setUser('alice')).rejects.toThrow('network down');
    await authorizer.setUser('alice');

    expect(attempts).toBe(2);
    expect(await authorizer.can('read', 'data1')).toBe(true);
});

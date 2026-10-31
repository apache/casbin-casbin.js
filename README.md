# Casbin.js

[![GitHub Actions](https://github.com/apache/casbin-casbin.js/workflows/build/badge.svg)](https://github.com/apache/casbin-casbin.js/actions)
[![Release](https://img.shields.io/github/release/apache/casbin-casbin.js.svg)](https://github.com/apache/casbin-casbin.js/releases/latest)
[![NPM version][npm-image]][npm-url]
[![NPM download][download-image]][download-url]
[![install size](https://packagephobia.now.sh/badge?p=casbin.js)](https://packagephobia.now.sh/result?p=casbin.js)
[![Discord](https://img.shields.io/discord/1022748306096537660?logo=discord&label=discord&color=5865F2)](https://discord.com/invite/S5UjpzGZjN)

[npm-image]: https://img.shields.io/npm/v/casbin.js.svg?style=flat-square
[npm-url]: https://npmjs.org/package/casbin.js
[download-image]: https://img.shields.io/npm/dm/casbin.js.svg?style=flat-square
[download-url]: https://npmjs.org/package/casbin.js

Casbin.js is the frontend authorization library of [Casbin](https://casbin.apache.org). It evaluates the permission of the current user in a browser with the same model and policies as the backend, for access control models like ACL, RBAC and ABAC.

## Installation

```bash
npm install casbin.js
```

or

```bash
yarn add casbin.js
```

## Modes

Casbin.js can load the permission in three ways:

| Mode | How the permission arrives |
| --- | --- |
| `manual` | The application passes it to `setPermission` |
| `auto` | Casbin.js fetches it from a backend endpoint when the user changes |
| `cookies` | Casbin.js reads it from a cookie set by the backend |

### Manual mode

`setPermission` accepts either a map of actions to objects, or the model and policies produced by the backend's `CasbinJsGetPermissionForUser`.

```javascript
const casbin = require('casbin.js');

// A map of actions to objects: the user can read data1 and data2, and write data1.
const authorizer = new casbin.Authorizer('manual');
authorizer.setPermission({
    read: ['data1', 'data2'],
    write: ['data1'],
});

await authorizer.can('read', 'data1'); // true
await authorizer.cannot('write', 'data2'); // true
```

The map form is a flattened result. Use the model and policies when the backend returns roles, so that Casbin.js evaluates the same RBAC model itself:

```javascript
// The JSON string or object returned by CasbinJsGetPermissionForUser:
// { m: "...", p: [["p", "admin", "data1", "read"], ...], g: [["g", "alice", "admin"], ...] }
const authorizer = new casbin.Authorizer('manual');
authorizer.setPermission(responseFromApi);
await authorizer.setUser('alice');

await authorizer.can('read', 'data1');
await authorizer.getRoles(); // ["admin", ...]
await authorizer.getImplicitPermissions(); // [["admin", "data1", "read"], ...]
```

A user may hold several roles at the same time, and a role may inherit from another role. Casbin.js evaluates the `g` rules with the same RBAC engine as the backend, so the user gets the permissions of every one of those roles.

For a model with domains, pass the domain to each call: `authorizer.can('read', 'data1', 'domain1')`, `authorizer.getRoles('domain1')`.

### Auto mode

Point Casbin.js at a backend endpoint that serves the permission of a subject. The endpoint receives the user as the `subject` query parameter and returns `{ "message": "ok", "data": "<the CasbinJsGetPermissionForUser result>" }`.

```javascript
const authorizer = new casbin.Authorizer('auto', {
    endpoint: 'https://example.com/casbin/api',
    requestHeaders: { Authorization: 'Bearer ...' },
    cacheExpiredTime: 60, // seconds, defaults to 60
});

// When the identity changes, Casbin.js fetches and caches the new permission.
await authorizer.setUser('alice');
await authorizer.can('read', 'data1');

// The permission is cached in localStorage per endpoint and user.
authorizer.clearCache(); // drop the cached permission of the current user
await authorizer.refresh(); // drop it and load it again from the endpoint
```

`can` waits for a permission that `setUser` is still loading, so both of these work:

```javascript
authorizer.setUser('alice');
await authorizer.can('read', 'data1'); // waits for the request above
```

### Cookies mode

If the backend stores the permission in a cookie, Casbin.js reads it at construction time. The default cookie key is `access_perm`; pass `cookieKey` to use another one.

```javascript
// Reads the cookie "access_perm" and loads its JSON value.
const authorizer = new casbin.Authorizer('cookies');

// Or another cookie key.
const authorizer2 = new casbin.Authorizer('cookies', { cookieKey: 'my_perm' });

// Re-read the cookie after the backend refreshed it.
authorizer.loadPermissionFromCookie();
```

The cookie value can be either form accepted by `setPermission`. With the model-and-policies form, call `setUser` before evaluating the permission.

## API

| Method | Description |
| --- | --- |
| `new Authorizer(mode, options)` | `mode` is `"manual"`, `"auto"` or `"cookies"`. Options: `endpoint`, `cacheExpiredTime`, `requestHeaders`, `cookieKey`. |
| `setPermission(permission)` | Load the permission, as a JSON string or an object. |
| `getPermission()` | Get the action-to-objects permission. Only available for the map form. |
| `setUser(user)` | Set the subject. In `auto` mode this loads the permission. |
| `refresh()` | Reload the permission from the endpoint, ignoring the cache. Only in `auto` mode. |
| `clearCache()` | Remove the cached permission of the current user. |
| `loadPermissionFromCookie()` | Re-read the permission cookie. Only in `cookies` mode. |
| `can(action, object[, domain])` | Whether the current user can perform the action on the object. |
| `cannot(action, object[, domain])` | The negation of `can`. |
| `canAll(action, objects[, domain])` | Whether `can` is true for every object. |
| `canAny(action, objects[, domain])` | Whether `can` is true for at least one object. |
| `getRoles([domain])` | Every role of the user, the inherited ones included. Requires the model and policies. |
| `getImplicitPermissions([domain])` | Every permission of the user, the ones from its roles included. Requires the model and policies. |

## Development

```bash
yarn install
yarn lint
yarn test
yarn build
```

## Example

See the [React example](https://github.com/casbin-js/examples/tree/master/src) for a complete application.

## TODO

- [ ] Lightweight enforcer (avoid the abuse of async functions).
- [ ] Integration with other modern frontend frameworks.

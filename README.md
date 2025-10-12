# Casbin.js

[![GitHub Actions](https://github.com/casbin/casbin.js/workflows/build/badge.svg)](https://github.com/casbin/casbin.js/actions)
[![Release](https://img.shields.io/github/release/casbin/casbin.js.svg)](https://github.com/casbin/casbin.js/releases/latest)
[![NPM version][npm-image]][npm-url]
[![NPM download][download-image]][download-url]
[![install size](https://packagephobia.now.sh/badge?p=casbin.js)](https://packagephobia.now.sh/result?p=casbin.js)
[![Discord](https://img.shields.io/discord/1022748306096537660?logo=discord&label=discord&color=5865F2)](https://discord.gg/S5UjpzGZjN)

[npm-image]: https://img.shields.io/npm/v/casbin.js.svg?style=flat-square
[npm-url]: https://npmjs.org/package/casbin.js
[download-image]: https://img.shields.io/npm/dm/casbin.js.svg?style=flat-square
[download-url]: https://npmjs.org/package/casbin.js

Casbin.js is a frontend port of a backend Casbin service, which facilitates the manipulation, management and storage of the user permission in a frontend application.

## Example

We demonstrate the usage of Casbin.js with [a React app](https://github.com/casbin-js/examples/tree/master/src). View the code to see more details.


You can use `manual` mode in Casbin.js, and set the permission whenever you wish.
```javascript
const casbinjs = require('casbin.js');

// Set the user's permission:
// He/She can read 2 objects: data1 and data2
// Can write 1 objects: data1
const permission = {
    "read": ['data1', 'data2'],
    "write": ['data1']
}

// Run casbin.js in manual mode, which requires you to set the permission manually.
const authorizer = new casbinjs.Authorizer("manual");

authorizer.setPermission(permission);

authorizer.can("read", "data1").then(result => {
  console.log(result)
})
authorizer.cannot("write", "data2").then(result => {
  console.log(result)
});
```

You can also use the `auto` mode. In details, specify a casbin backend service endpoint when initializing the Casbin.js authorizer, and set the subject when the frontend user identity changes. Casbin.js will automatically fetch the permission from the endpoint. (A pre-configurated casbin service API is required at the backend.)
```javascript
const casbinjs = require('casbin.js');

// Set your backend casbin service url
const authorizer = new casbinjs.Authorizer('auto', {endpoint: 'http://Domain_name/casbin/api'});

// When the identity shifts, reset the user. Casbin.js will automatically fetch the permission from the endpoint.
await authorizer.setUser("Tom");

// Evaluate the permission
authorizer.can("read", "data1").then();
```

More functionalities of Casbin.js are still under development. Feel free to raise issues to share your features suggestions!

## TODO MAP
- [x] Permission cache.
- [ ] Cookie mode.
- [ ] Lightweight enforcer (avoid the abuse of async functions).
- [ ] Integration with other modern frontend frameworks.




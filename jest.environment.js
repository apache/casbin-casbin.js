// Custom jest environment that extends jsdom and injects the Node.js 18+
// native Fetch API into the jsdom window. jsdom 20 (used by jest-environment-jsdom 29)
// does not include fetch, but Node.js 18+ has it as a built-in global.
// This file intentionally uses CommonJS and plain JS so that jest can load it
// directly without going through a TypeScript transformation pipeline.

const JsDOMEnvironment = require('jest-environment-jsdom').default;

class FetchEnvironment extends JsDOMEnvironment {
    async setup() {
        await super.setup();
        // Inject the Node.js native Fetch API into the jsdom window object.
        // `fetch`, `Headers`, `Request` and `Response` are true globals in Node.js 18+,
        // so they are accessible here in the Node.js module scope.
        if (!this.global.fetch) {
            this.global.fetch = fetch;
            this.global.Headers = Headers;
            this.global.Request = Request;
            this.global.Response = Response;
        }
    }
}

module.exports = FetchEnvironment;

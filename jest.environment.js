const JsDOMEnvironment = require('jest-environment-jsdom').default;

class FetchEnvironment extends JsDOMEnvironment {
    async setup() {
        await super.setup();
        this.global.fetch = fetch;
        this.global.Headers = Headers;
        this.global.Request = Request;
        this.global.Response = Response;
    }
}

module.exports = FetchEnvironment;

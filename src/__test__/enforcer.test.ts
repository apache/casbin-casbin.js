import * as casbin from "casbin-core"
import { Authorizer } from "../Authorizer";
import { basicModelStr, rbacWithDomainsModelStr, rbacModelStr} from './models';

const respData = JSON.stringify({
    m: basicModelStr,
    p: [
        ["p", "alice", "data1", "read"],
        ["p", "alice", "data2", "write"]
    ]
});

test('Authorizer enforcer API', async() => {
    const authorizer = new Authorizer("auto", {endpoint: "whatever"});
    await authorizer.initEnforcer(respData);
    authorizer.user = "alice";
    expect(await authorizer.can("write", "data2")).toBe(true);
    expect(await authorizer.cannot("read", "data2")).toBe(true);
    expect(await authorizer.canAll("read", ["data1", "data2"])).toBe(false);
    expect(await authorizer.canAny("read", ["data1", "data2"])).toBe(true);
})

const respDataWithDomain = JSON.stringify({
    m:rbacWithDomainsModelStr,
    p: [
        [
            "p",
            "admin",
            "domain1",
            "data1",
            "read"
        ],
        [
            "p",
            "admin",
            "domain1",
            "data2",
            "write"
        ],
        [
            "g",
            "alice",
            "admin",
            "domain1"
        ],
    ]
})

test('Authorizer enforcer with domain API', async() => {
    const authorizer = new Authorizer("auto", {endpoint: "whatever"});
    await authorizer.initEnforcer(respDataWithDomain);
    authorizer.user = "alice";
    expect(await authorizer.can("read", "data1", "domain1")).toBe(true);
    expect(await authorizer.cannot("write", "data1", "domain1")).toBe(true);
    expect(await authorizer.canAny("write", ["data1", "data2"], "domain1")).toBe(true);
    expect(await authorizer.canAll("write", ["data1", "data2"], "domain1")).toBe(false);
})

const s = `[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && r.obj == p.obj && r.act == p.act
`

test('Load casbin from strings.', async () => {
    const m = new casbin.Model(s);
    const e = await casbin.newEnforcer(m);

    await e.addPolicy("alice", "data1", "read");
    expect(await e.enforce("alice", "data1", "read")).toBe(true);
    expect(await e.enforce("alice", "data1", "write")).toBe(false);
})

const rbacMultipleRolesRespData = JSON.stringify({
    m: rbacModelStr,
    p: [
        ["p", "admin", "data1", "read"],
        ["p", "admin", "data1", "write"],
        ["p", "editor", "data2", "read"],
        ["p", "editor", "data2", "write"],
        ["p", "viewer", "data3", "read"],
        ["g", "alice", "admin"],
        ["g", "alice", "editor"],
        ["g", "bob", "editor"],
        ["g", "bob", "viewer"]
    ]
})

test('Authorizer with multiple roles per user', async() => {
    const authorizer = new Authorizer("auto", {endpoint: "whatever"});
    await authorizer.initEnforcer(rbacMultipleRolesRespData);
    
    // Test alice who has both admin and editor roles
    authorizer.user = "alice";
    // Alice should have admin permissions on data1
    expect(await authorizer.can("read", "data1")).toBe(true);
    expect(await authorizer.can("write", "data1")).toBe(true);
    // Alice should have editor permissions on data2
    expect(await authorizer.can("read", "data2")).toBe(true);
    expect(await authorizer.can("write", "data2")).toBe(true);
    // Alice should NOT have permissions on data3 (viewer role)
    expect(await authorizer.can("read", "data3")).toBe(false);
    
    // Test bob who has both editor and viewer roles
    authorizer.user = "bob";
    // Bob should NOT have permissions on data1 (admin role)
    expect(await authorizer.can("read", "data1")).toBe(false);
    expect(await authorizer.can("write", "data1")).toBe(false);
    // Bob should have editor permissions on data2
    expect(await authorizer.can("read", "data2")).toBe(true);
    expect(await authorizer.can("write", "data2")).toBe(true);
    // Bob should have viewer permissions on data3
    expect(await authorizer.can("read", "data3")).toBe(true);
    expect(await authorizer.cannot("write", "data3")).toBe(true);
})

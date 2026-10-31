import * as casbin from 'casbin-core';
import Cookies from 'js-cookie';
import Permission from './Permission';
import { EnforcerData, HeaderMap, PermissionSource, StringKV } from './types';
import * as Cache from './Cache';

interface BaseResponse {
    message: string;
    data: PermissionSource;
}

export type Mode = 'auto' | 'cookies' | 'manual';

export interface AuthorizerOptions {
    /** Casbin service endpoint, required when mode == "auto" */
    endpoint?: string;
    /** The expired time of the local cache, in seconds. Default: 60s, activated when mode == "auto" */
    cacheExpiredTime?: number;
    /** Extra headers sent with every request to the endpoint */
    requestHeaders?: HeaderMap;
    /** The cookie key when loading the permission, activated when mode == "cookies". Default: "access_perm" */
    cookieKey?: string;
}

const DEFAULT_COOKIE_KEY = 'access_perm';

/**
 * Whether the object is the model + policies produced by casbin's
 * "CasbinJsGetPermissionForUser", rather than an action-to-objects map.
 */
function isEnforcerData(obj: unknown): obj is EnforcerData {
    return typeof obj === 'object' && obj !== null && typeof (obj as Record<string, unknown>)['m'] === 'string';
}

export class Authorizer {
    public mode!: Mode;
    public endpoint?: string;
    public requestHeaders?: HeaderMap;
    public permission?: Permission;
    public cookieKey?: string;
    public cacheExpiredTime = 60; // Seconds
    public user?: string;
    public enforcer?: casbin.Enforcer;

    private enforcerPromise?: Promise<void>;
    private userLoadPromise?: Promise<void>;
    private userLoadTarget?: string;
    /** Incremented whenever the permission is replaced, so a slow load cannot overwrite a newer one. */
    private stateVersion = 0;

    /**
     *
     * @param mode "auto", "cookies" or "manual"
     * "auto": Specify the casbin server endpoint, and Casbin.js will load permission from it when the identity changes
     * "cookies": Casbin.js loads the permission data from the cookie "access_perm" or the specified cookie key.
     * "manual": Load the permission manually with "setPermission"
     * @param args
     * @param args.endpoint Casbin service endpoint, REQUIRED when mode == "auto"
     * @param args.cacheExpiredTime The expired time of local cache, Unit: seconds, Default: 60s, activated when mode == "auto"
     * @param args.requestHeaders Extra headers sent with every request to the endpoint, activated when mode == "auto"
     * @param args.cookieKey The cookie key when loading permission, activated when mode == "cookies"
     */
    constructor(mode: Mode = 'manual', args: AuthorizerOptions = {}) {
        if (mode == 'auto') {
            if (!args.endpoint) {
                throw new Error("Specify the endpoint when initializing casbin.js with mode == 'auto'");
            }
            this.mode = mode;
            this.endpoint = args.endpoint;
            this.requestHeaders = args.requestHeaders;
            if (args.cacheExpiredTime !== null && args.cacheExpiredTime !== undefined) {
                this.cacheExpiredTime = args.cacheExpiredTime;
            }
        } else if (mode == 'cookies') {
            this.mode = mode;
            this.cookieKey = args.cookieKey ?? DEFAULT_COOKIE_KEY;
            this.loadPermissionFromCookie();
        } else if (mode == 'manual') {
            this.mode = mode;
        } else {
            throw new Error("Casbin.js mode can only be one of the 'auto', 'cookies' and 'manual'");
        }
    }

    /**
     * Get the action-to-objects permission. Only available when the permission
     * was loaded as such a map; the model and policies of
     * "CasbinJsGetPermissionForUser" are evaluated by "can" instead.
     */
    public getPermission(): StringKV {
        if (this.permission === undefined) {
            throw Error(
                'No action-to-objects permission is loaded. "getPermission" only works with the map form passed to "setPermission".',
            );
        }
        return this.permission.getPermissionJsonObject();
    }

    /**
     * Load the permission data.
     *
     * Two shapes are accepted:
     * - A map of actions to objects, e.g. {"read": ["data1", "data2"], "write": ["data1"]}
     * - The model and policies returned by casbin's "CasbinJsGetPermissionForUser"
     *   (a JSON object with the keys "m", "p" and "g"). In this case an enforcer is
     *   built from that data, and "can" evaluates the model instead of a static map.
     */
    public setPermission(permission: Record<string, unknown> | string): void {
        const obj = typeof permission === 'string' ? JSON.parse(permission) : permission;
        if (isEnforcerData(obj)) {
            this.enforcerPromise = this.initEnforcer(obj);
            // The rejection is surfaced when "can" awaits the promise, this only
            // keeps it from being reported as an unhandled rejection meanwhile.
            this.enforcerPromise.catch(() => undefined);
            return;
        }
        // A previously built enforcer, or one that is still being built, must not
        // take precedence in "can" once a plain action-to-objects map is set.
        this.stateVersion++;
        this.enforcer = undefined;
        this.enforcerPromise = undefined;
        if (this.permission === undefined) {
            this.permission = new Permission();
        }
        this.permission.load(obj);
    }

    /**
     * Build an enforcer from the model and policies of "CasbinJsGetPermissionForUser".
     */
    public async initEnforcer(permission: PermissionSource): Promise<void> {
        const obj = typeof permission === 'string' ? JSON.parse(permission) : permission;
        if (!isEnforcerData(obj)) {
            throw Error('No model when init enforcer.');
        }
        const version = ++this.stateVersion;
        // Drop the previous state first, so a failed or half-finished load never
        // leaves the permissions of the former identity in place.
        this.enforcer = undefined;
        this.permission = undefined;
        const m = new casbin.Model(obj.m);
        const enforcer = await casbin.newEnforcer(m);
        // "CasbinJsGetPermissionForUser" puts the policies under "p" and the grouping
        // policies under "g", each rule prefixed with its own ptype. The grouping
        // policies carry the role assignments, including the several roles a single
        // user may have, and any role that inherits from another role.
        for (const section of ['p', 'g'] as const) {
            if (section in obj) {
                await this.loadRules(enforcer, obj[section]);
            }
        }
        // A newer permission replaced this one while the enforcer was being built.
        if (version !== this.stateVersion) {
            return;
        }
        this.enforcer = enforcer;
    }

    private async loadRules(enforcer: casbin.Enforcer, rules: unknown): Promise<void> {
        if (!Array.isArray(rules)) {
            return;
        }
        for (const rule of rules) {
            if (!Array.isArray(rule) || rule.length === 0) {
                continue;
            }
            const arr = rule.map((v) => String(v).trim());
            const pType = arr.shift();
            if (!pType) {
                continue;
            }
            if (pType.startsWith('g')) {
                await enforcer.addNamedGroupingPolicy(pType, ...arr);
            } else {
                await enforcer.addNamedPolicy(pType, ...arr);
            }
        }
    }

    /**
     * Fetch the permission data from the configured endpoint.
     */
    public async getEnforcerDataFromSvr(): Promise<PermissionSource> {
        if (this.endpoint === undefined || this.endpoint === null) {
            throw Error('Endpoint is null or not specified.');
        }
        const subject = this.requireUser();
        const separator = this.endpoint.includes('?') ? '&' : '?';
        const resp = await fetch(`${this.endpoint}${separator}subject=${encodeURIComponent(subject)}`, {
            headers: this.requestHeaders,
        });
        if (!resp.ok) {
            throw new Error(`Failed to load the permission from ${this.endpoint}: HTTP ${resp.status}`);
        }
        let body: BaseResponse;
        try {
            body = await resp.json();
        } catch (e) {
            throw new Error(`The endpoint ${this.endpoint} did not return valid JSON.`);
        }
        if (body === null || typeof body !== 'object' || body.data === undefined) {
            throw new Error(`The endpoint ${this.endpoint} did not return a "data" field.`);
        }
        return body.data;
    }

    /**
     * Set the user subject for the authorizer.
     * In "auto" mode the permission of the user is loaded from the endpoint,
     * or from the local cache when it has not expired yet.
     * @param user The current user
     */
    public async setUser(user: string): Promise<void> {
        if (this.mode != 'auto') {
            this.user = user;
            return;
        }
        if (this.userLoadPromise !== undefined && this.userLoadTarget === user) {
            // The same identity is already being loaded, share its result.
            return this.userLoadPromise;
        }
        if (user === this.user && this.userLoadPromise === undefined && (this.enforcer !== undefined || this.permission !== undefined)) {
            return;
        }
        await this.loadUser(user);
    }

    /**
     * Load the permission of the current user again from the endpoint, ignoring
     * the local cache. Only available in "auto" mode.
     */
    public async refresh(): Promise<void> {
        if (this.mode != 'auto') {
            throw Error('"refresh" is only available in auto mode.');
        }
        const user = this.requireUser();
        Cache.removeLocalStorage(this.cacheKey(user));
        await this.loadUser(user);
    }

    /**
     * Remove the cached permission of the current user.
     */
    public clearCache(): void {
        if (this.user === undefined) {
            return;
        }
        Cache.removeLocalStorage(this.cacheKey(this.user));
    }

    private cacheKey(user: string): string {
        // Two authorizers on the same origin may point at different endpoints,
        // so the same user name must not share a cached permission between them.
        return this.endpoint === undefined ? user : `${this.endpoint}::${user}`;
    }

    private async loadUser(user: string): Promise<void> {
        this.user = user;
        // The permission of the former identity must not stay in use while the
        // new one is loading, otherwise a slow request would keep the old rights.
        // Bumping the version also invalidates an enforcer that is still being built.
        this.stateVersion++;
        this.enforcer = undefined;
        this.permission = undefined;
        this.enforcerPromise = undefined;
        const load = (async () => {
            const key = this.cacheKey(user);
            const cached = Cache.loadFromLocalStorage(key);
            let config: PermissionSource;
            if (cached === null) {
                config = await this.getEnforcerDataFromSvr();
                Cache.saveToLocalStorage(key, typeof config === 'string' ? config : JSON.stringify(config), this.cacheExpiredTime);
            } else {
                config = cached;
            }
            // Another identity was requested while this one was loading.
            if (this.user !== user) {
                return;
            }
            await this.initEnforcer(config);
        })();
        this.userLoadTarget = user;
        this.userLoadPromise = load;
        try {
            await load;
        } finally {
            if (this.userLoadPromise === load) {
                this.userLoadPromise = undefined;
                this.userLoadTarget = undefined;
            }
        }
    }

    /**
     * Read the permission from the cookie and load it. Only available in "cookies" mode.
     * @returns Whether a permission cookie was found.
     */
    public loadPermissionFromCookie(): boolean {
        if (this.mode != 'cookies') {
            throw Error('"loadPermissionFromCookie" is only available in cookies mode.');
        }
        const key = this.cookieKey ?? DEFAULT_COOKIE_KEY;
        const permission = Cookies.get(key);
        if (permission === undefined) {
            console.warn(`WARNING: No cookie named "${key}" was found.`);
            return false;
        }
        try {
            this.setPermission(permission);
        } catch (e) {
            throw new Error(`The cookie "${key}" does not contain a valid permission: ${(e as Error).message}`);
        }
        return true;
    }

    /**
     * Get every role of the current user, the roles inherited from another role
     * included. Only available when the permission was loaded from the data of
     * "CasbinJsGetPermissionForUser", since a plain action-to-objects map holds
     * no roles.
     * @param domain The domain, for a model with domains
     */
    public async getRoles(domain?: string): Promise<string[]> {
        await this.settle();
        const enforcer = this.getEnforcerOrThrow();
        const user = this.requireUser();
        return domain === undefined ? await enforcer.getImplicitRolesForUser(user) : await enforcer.getImplicitRolesForUser(user, domain);
    }

    /**
     * Get every permission of the current user, the ones coming from the user's
     * roles included. Same requirement as "getRoles".
     * @param domain The domain, for a model with domains
     */
    public async getImplicitPermissions(domain?: string): Promise<string[][]> {
        await this.settle();
        const enforcer = this.getEnforcerOrThrow();
        const user = this.requireUser();
        return domain === undefined
            ? await enforcer.getImplicitPermissionsForUser(user)
            : await enforcer.getImplicitPermissionsForUser(user, domain);
    }

    private async settle(): Promise<void> {
        if (this.userLoadPromise !== undefined) {
            await this.userLoadPromise;
        }
        if (this.enforcerPromise !== undefined) {
            await this.enforcerPromise;
        }
    }

    private getEnforcerOrThrow(): casbin.Enforcer {
        if (this.enforcer === undefined) {
            throw Error(
                'Enforcer not initialized. Roles are only available when the permission ' +
                    'is the model and policies of "CasbinJsGetPermissionForUser".',
            );
        }
        return this.enforcer;
    }

    private requireUser(): string {
        if (this.user === undefined) {
            throw Error('User is not defined. Call "setUser" before evaluating the permission.');
        }
        return this.user;
    }

    public async can(action: string, object: string, domain?: string): Promise<boolean> {
        await this.settle();
        if (this.enforcer !== undefined) {
            // Without a subject every request would silently be denied.
            const user = this.requireUser();
            if (domain == undefined) {
                return await this.enforcer.enforce(user, object, action);
            } else {
                return await this.enforcer.enforce(user, domain, object, action);
            }
        }
        if (this.mode == 'manual' || this.mode == 'cookies') {
            return this.permission !== undefined && this.permission.check(action, object);
        } else if (this.mode == 'auto') {
            throw Error('Permission is not loaded. Set the user with "setUser" first.');
        } else {
            throw Error(`Mode ${this.mode} not recognized.`);
        }
    }

    public async cannot(action: string, object: string, domain?: string): Promise<boolean> {
        return !(await this.can(action, object, domain));
    }

    public async canAll(action: string, objects: string[], domain?: string): Promise<boolean> {
        for (let i = 0; i < objects.length; ++i) {
            if (await this.cannot(action, objects[i], domain)) {
                return false;
            }
        }
        return true;
    }

    public async canAny(action: string, objects: string[], domain?: string): Promise<boolean> {
        for (let i = 0; i < objects.length; ++i) {
            if (await this.can(action, objects[i], domain)) {
                return true;
            }
        }
        return false;
    }
}

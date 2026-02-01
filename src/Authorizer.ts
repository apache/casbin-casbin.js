import axios from 'axios';
import * as casbin from 'casbin-core';
import Permission from './Permission';
import { StringKV } from './types';
import * as Cache from './Cache';

interface BaseResponse {
    message: string;
    data: any;
}

type Mode = "auto" | "cookies" | "manual"

export class Authorizer {
    public mode!: Mode;
    public endpoint: string | undefined = undefined;
    public requestHeaders: StringKV | undefined = undefined;
    public permission: Permission | undefined;
    public cookieKey : string | undefined = undefined;
    public cacheExpiredTime  = 60; // Seconds
    public user : string | undefined;
    public enforcer:casbin.Enforcer | undefined;

    /**
     *
     * @param mode "auto", "cookies" or "manual"
     * "auto": Specify the casbin server endpoint, and Casbin.js will load permission from it when the identity changes
     * "cookies": Casbin.js load the permission data from the cookie "access_perm" or the specified cookie key.
     * "manual": Load the permission mannually with "setPermission"
     * @param args
     * @param args.endpoint Casbin service endpoint, REQUIRED when mode == "auto"
     * @param args.cacheExpiredTime The expired time of local cache, Unit: seconds, Default: 60s, activated when mode == "auto"
     * @param args.cookieKey The cookie key when loading permission, activated when mode == "cookies"
     */
    constructor(mode: Mode = 'manual', args: { endpoint?: string; cacheExpiredTime?: number; requestHeaders?: StringKV } = {}) {
        if (mode == 'auto') {
            if (!args.endpoint) {
                throw new Error("Specify the endpoint when initializing casbin.js with mode == 'auto'");
            } else {
                this.mode = mode;
                this.endpoint = args.endpoint;
                if (args.requestHeaders) {
                    this.requestHeaders = args.requestHeaders;
                }
                if (args.cacheExpiredTime !== null && args.cacheExpiredTime !== undefined) {
                    this.cacheExpiredTime = args.cacheExpiredTime;
                }
            }
        } else if (mode == 'cookies') {
            throw Error("Cookie mode not implemented.");
            /*
            this.mode = mode;
            const permission = Cookies.get(args.cookieKey ? args.cookieKey : "access_perm");
            if (permission) {
                this.setPermission(permission);
            } else {
                console.log("WARNING: No specified cookies");
            }
            */
        } else if (mode == 'manual') {
            this.mode = mode;
        } else {
            throw new Error("Casbin.js mode can only be one of the 'auto', 'cookies' and 'manual'");
        }
    }

    /**
     * Get the permission.
     */
    public getPermission() : StringKV {
        if (this.permission !== undefined) {
            return this.permission?.getPermissionJsonObject();
        } else {
            throw Error("Permission is not defined. Are you using manual mode and have set the permission?");
            return {} as StringKV;
        }
    }

    public async setPermission(permission : Record<string, unknown> | string) : Promise<void>{
        // Parse permission if it's a string
        let permObj: Record<string, unknown>;
        if (typeof permission === 'string') {
            permObj = JSON.parse(permission);
        } else {
            permObj = permission;
        }

        // Check if this is enforcer format (has 'm' and 'p' keys from CasbinJsGetPermissionForUser)
        if ('m' in permObj && 'p' in permObj) {
            // Initialize enforcer with the provided data
            await this.initEnforcer(typeof permission === 'string' ? permission : JSON.stringify(permission));
        } else {
            // Use simple permission format for manual mode
            if (this.permission === undefined) {
                this.permission = new Permission();
            }
            this.permission.load(permission);
        }
    }

    public async initEnforcer(s: string): Promise<void> {
        const obj = JSON.parse(s);
        if (!('m' in obj)) {
            throw Error("No model when init enforcer.");
        }
        const m = new casbin.Model(obj['m']);
        this.enforcer = await casbin.newEnforcer(m);
        if ('p' in obj) {
            for (const sArray of obj['p']) {
                let arr = sArray as string[];
                arr = arr.map(v => v.trim())
                const pType = arr.shift()
                if (pType == 'p'){
                    await this.enforcer.addPolicy(...arr);
                } else if (pType == 'g'){
                    await this.enforcer.addGroupingPolicy(...arr);
                }
            }
        }
        // Also process 'g' policies if they exist in a separate key
        if ('g' in obj) {
            for (const sArray of obj['g']) {
                let arr = sArray as string[];
                arr = arr.map(v => v.trim())
                // Remove and discard the pType prefix (e.g., "g") before adding to enforcer
                arr.shift();
                await this.enforcer.addGroupingPolicy(...arr);
            }
        }
    }

    /**
     * Initialize the enforcer
     */
    public async getEnforcerDataFromSvr(): Promise<string>{
        if (this.endpoint === undefined || this.endpoint === null) {
            throw Error("Endpoint is null or not specified.");
        }
        const resp = await axios.get<BaseResponse>(`${this.endpoint}?subject=${this.user}`, {
            headers: this.requestHeaders,
        });
        return resp.data.data;
    }

    /**
     * Set the user subject for the authroizer
     * @param user The current user
     */
    public async setUser(user : string) : Promise<void> {
        if (this.mode == 'auto' && user !== this.user) {
            this.user = user;
            let config = Cache.loadFromLocalStorage(user);
            if (config === null) {
                config = await this.getEnforcerDataFromSvr();
                Cache.saveToLocalStorage(user, config, this.cacheExpiredTime);
            }
            await this.initEnforcer(config);
        } else {
            // For manual mode, just set the user for enforcer checks
            this.user = user;
        }
    }

    public async can(action: string, object: string, domain?: string): Promise<boolean> {
        if (this.mode == "manual") {
            // If enforcer is initialized (from CasbinJsGetPermissionForUser format), use it
            if (this.enforcer !== undefined) {
                if (this.user === undefined) {
                    throw Error("User not set. Call setUser() first when using enforcer format.");
                }
                if (domain == undefined) {
                    return await this.enforcer.enforce(this.user, object, action);
                } else {
                    return await this.enforcer.enforce(this.user, domain, object, action);
                }
            }
            // Otherwise use simple permission check
            return this.permission !== undefined && this.permission.check(action, object);
        } else if (this.mode == "auto") {
            if (this.enforcer === undefined) {
                throw Error("Enforcer not initialized");
            } else if (domain == undefined) {
                return await this.enforcer.enforce(this.user, object, action);
            } else {
                return await this.enforcer.enforce(this.user, domain, object, action);
            }
        } else {
            throw Error(`Mode ${this.mode} not recognized.`);
        }
    }

    public async cannot(action: string, object: string, domain?: string): Promise<boolean> {
        return !(await this.can(action, object, domain));
    }

    public async canAll(action: string, objects: string[], domain?: string) : Promise<boolean> {
        for (let i = 0; i < objects.length; ++i) {
            if (await this.cannot(action, objects[i], domain)) {
                return false;
            }
        }
        return true;
    }

    public async canAny(action: string, objects: string[], domain?: string) : Promise<boolean> {
        for (let i = 0; i < objects.length; ++i) {
            if (await this.can(action, objects[i], domain)) {
                return true;
            }
        }
        return false;
    }

}

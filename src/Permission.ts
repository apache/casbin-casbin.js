import { StringKV } from './types';

export default class Permission {
    private actObjData: Map<string, Array<string>>;
    private objActData: Map<string, Array<string>>;

    public constructor() {
        this.actObjData = new Map<string, Array<string>>();
        this.objActData = new Map<string, Array<string>>();
    }

    public load(permission: string | Record<string, unknown>): void {
        const p = typeof permission === 'string' ? JSON.parse(permission) : permission;
        if (p === null || typeof p !== 'object' || Array.isArray(p)) {
            throw new Error('The permission must be a JSON object that maps actions to arrays of objects.');
        }

        // Validate before touching the current permission, a malformed input
        // must not leave a half-loaded one behind.
        const entries: Array<[string, Array<string>]> = [];
        for (const act of Object.keys(p)) {
            const objects = (p as Record<string, unknown>)[act];
            if (!Array.isArray(objects)) {
                throw new Error(`The permission of action "${act}" must be an array of objects.`);
            }
            entries.push([act, objects as Array<string>]);
        }

        // A load replaces the permission, it does not merge into the previous one.
        // Otherwise the permissions of a former user or role would leak into the
        // current one when the identity changes.
        this.actObjData.clear();
        this.objActData.clear();

        const objActData = new Map<string, Array<string>>();
        for (const [act, objects] of entries) {
            this.actObjData.set(act, objects);

            // Generate data: {key:Objects, value: Array of actions}
            // A Map is used instead of an object so that an object name such
            // as "__proto__" is stored as plain data.
            for (const obj of objects) {
                const actions = objActData.get(obj);
                if (actions === undefined) {
                    objActData.set(obj, [act]);
                } else {
                    actions.push(act);
                }
            }
        }
        objActData.forEach((actions, obj) => this.objActData.set(obj, actions));
    }

    public getPermissionJsonObject(): StringKV {
        const obj: StringKV = {};
        this.actObjData.forEach((value, key) => {
            // defineProperty keeps an action named "__proto__" an ordinary own
            // property instead of mutating the prototype of the result.
            Object.defineProperty(obj, key, { value: value.slice(), enumerable: true, writable: true, configurable: true });
        });
        return obj;
    }

    /*
        Parse the permission into JSON string
    */
    public getPermissionString(): string {
        return JSON.stringify(this.getPermissionJsonObject());
    }

    public getTargetsFromAction(action: string): Array<string> {
        const result = this.actObjData.get(action);
        if (result === undefined) {
            return new Array<string>();
        } else {
            return result;
        }
    }

    public getActionsObjects(): Map<string, Array<string>> {
        return this.actObjData;
    }

    public getObjectsActions(): Map<string, Array<string>> {
        return this.objActData;
    }

    public check(action: string, object: string): boolean {
        const objects = this.actObjData.get(action);
        if (objects == undefined) {
            return false;
        } else {
            return objects.includes(object);
        }
    }
}

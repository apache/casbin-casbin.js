import * as http from "http";
import express from 'express';
import { newEnforcer, Enforcer, Model } from 'casbin-core';
import { StringKV } from '../types';
import { basicModelStr, rbacModelStr } from './models';
import { rbacMultipleRolesPolicies } from './policies';

class CasbinService {
    private enforcer! : Enforcer;
    
    public async run() {
        // RBAC API doesn't support RBAC w/ domain.
        // this.enforcer = await newEnforcer('./src/__test__/example/rbac_with_domains_model.conf', './src/__test__/example/rbac_with_domains_policy.csv');
        this.enforcer = await newEnforcer(new Model(basicModelStr));
    }
    
    public async runWithRBAC() {
        const m = new Model(rbacModelStr);
        this.enforcer = await newEnforcer(m);
        // Load policies for RBAC with multiple roles
        for (const policy of rbacMultipleRolesPolicies) {
            const trimmedPolicy = policy.map(p => p.trim()).filter(p => p !== '');
            if (trimmedPolicy.length > 0) {
                const pType = trimmedPolicy[0];
                const args = trimmedPolicy.slice(1);
                if (pType === 'p') {
                    await this.enforcer.addPolicy(...args);
                } else if (pType === 'g') {
                    await this.enforcer.addGroupingPolicy(...args);
                }
            }
        }
    }
    
    public async getEnforcerConfig(sub: string): Promise<string> {

        const obj: any = {};

        const m = this.enforcer.getModel().model;
          let s = "";
          s += "[request_definition]\n";
          s += `r = ${m.get('r')?.get('r')?.value.replace(/_/g, ".")}\n`;
          s += "[policy_definition]\n";
          s += `p = ${m.get('p')?.get('p')?.value.replace(/_/g, ".")}\n`;
          if (m.get('g')?.get('g') !== undefined) {
            s += "[role_definition]\n";
            s += `g = ${m.get('g')?.get('g')?.value}\n`
          }
          s += "[policy_effect]\n"
          s += `e = ${m.get('e')?.get('e')?.value.replace(/_/g, ".")}\n`;
          s += "[matchers]\n";
          s += `m = ${m.get('m')?.get('m')?.value.replace(/_/g, ".")}`;
        obj['m'] = s;
        obj['p'] = await this.enforcer.getPolicy();
        for (const arr of obj['p']) {
            arr.splice(0, 0, 'p');
        }
        
        // Include grouping policies (role assignments) for RBAC support
        const groupingPolicies = await this.enforcer.getGroupingPolicy();
        for (const arr of groupingPolicies) {
            arr.splice(0, 0, 'g');
            obj['p'].push(arr);
        }
        
        return JSON.stringify(obj);
    }
}

class TestServer {
    private app: express.Application;
    private port = 4000;
    private listener!: http.Server;
    private casbinServ: CasbinService;
    public constructor(port?: number) {
        if (port) {
            this.port = port;
        }
        this.app = express();
        this.casbinServ = new CasbinService();
        
    }

    private setRouter(): void {
        this.app.get('/', (req: express.Request, res: express.Response) => {
            res.status(200).json({
                message: 'ok',
                data: 'this is the data'
            })
        });
        this.app.get('/api/permissions', async (req: express.Request, res: express.Response) => {
            const sub = String(req.query["subject"]);
            const config = await this.casbinServ.getEnforcerConfig(sub);
            res.status(200).json({
                message: 'ok',
                data: config
            })
        })
    }

    private startServer(): Promise<void> {
        return new Promise((resolve) => {
            this.listener = this.app.listen(this.port, () => {
                console.log(`Express server is listening at http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    public async start() : Promise<void> {
        await this.casbinServ.run();
        this.setRouter();
        return this.startServer();
    }

    public async startWithRBAC() : Promise<void> {
        await this.casbinServ.runWithRBAC();
        this.setRouter();
        return this.startServer();
    }

    public terminate() : void {
        this.listener.close();
        console.log('Express server is terminated');
    }
}

export default TestServer;

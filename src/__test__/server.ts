import * as http from "http";
import express from 'express';
import { newEnforcer, Enforcer, Model } from 'casbin-core';
import { StringKV } from '../types';
import { basicModelStr } from './models'

class CasbinService {
    private enforcer! : Enforcer;
    
    public async run() {
        // RBAC API doesn't support RBAC w/ domain.
        // this.enforcer = await newEnforcer('./src/__test__/example/rbac_with_domains_model.conf', './src/__test__/example/rbac_with_domains_policy.csv');
        this.enforcer = await newEnforcer(new Model(basicModelStr));
        // These policies mirror basicPolicies from policies.ts, which the integration test's
        // check() helper expects. Previously this was never reached because jest.mock('axios')
        // intercepted all HTTP calls before they hit the server. Now that auto mode uses native
        // fetch, the test makes a real HTTP request, so the server must have policies loaded.
        await this.enforcer.addPolicy('alice', 'data1', 'read');
        await this.enforcer.addPolicy('alice', 'data2', 'read');
        await this.enforcer.addPolicy('alice', 'data2', 'write');
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

    public async start() : Promise<void> {
        await this.casbinServ.run();
        this.setRouter();
        this.listener = this.app.listen(this.port, () => console.log(`Express server is listening at http://localhost:${this.port}`));
    }

    public terminate() : void {
        this.listener.close();
        console.log('Express server is terminated');
    }
}

export default TestServer;

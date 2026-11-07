/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

import * as http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { newEnforcer, Enforcer, Model } from 'casbin-core';
import { basicModelStr } from './models';
import { basicPolicies } from './policies';

class CasbinService {
    private enforcer!: Enforcer;

    public async run() {
        // RBAC API doesn't support RBAC w/ domain.
        // this.enforcer = await newEnforcer('./src/__test__/example/rbac_with_domains_model.conf', './src/__test__/example/rbac_with_domains_policy.csv');
        this.enforcer = await newEnforcer(new Model(basicModelStr));
        for (const policy of basicPolicies) {
            const arr = policy.map((v) => v.trim());
            const pType = arr.shift();
            if (pType === 'p') {
                await this.enforcer.addPolicy(...arr);
            }
        }
    }

    public async getEnforcerConfig(sub: string): Promise<string> {
        const obj: any = {};

        const m = this.enforcer.getModel().model;
        let s = '';
        s += '[request_definition]\n';
        s += `r = ${m.get('r')?.get('r')?.value.replace(/_/g, '.')}\n`;
        s += '[policy_definition]\n';
        s += `p = ${m.get('p')?.get('p')?.value.replace(/_/g, '.')}\n`;
        if (m.get('g')?.get('g') !== undefined) {
            s += '[role_definition]\n';
            s += `g = ${m.get('g')?.get('g')?.value}\n`;
        }
        s += '[policy_effect]\n';
        s += `e = ${m.get('e')?.get('e')?.value.replace(/_/g, '.')}\n`;
        s += '[matchers]\n';
        s += `m = ${m.get('m')?.get('m')?.value.replace(/_/g, '.')}`;
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
    private listener!: http.Server;
    private casbinServ: CasbinService;
    private requestedPort: number;
    /** The port the server is actually listening on, 0 picks a free one. */
    public port: number;

    public constructor(port?: number) {
        this.requestedPort = port ?? 0;
        this.port = this.requestedPort;
        this.app = express();
        this.casbinServ = new CasbinService();
    }

    private setRouter(): void {
        this.app.get('/', (req: express.Request, res: express.Response) => {
            res.status(200).json({
                message: 'ok',
                data: 'this is the data',
            });
        });
        this.app.get('/api/permissions', async (req: express.Request, res: express.Response) => {
            const sub = String(req.query['subject']);
            const config = await this.casbinServ.getEnforcerConfig(sub);
            res.status(200).json({
                message: 'ok',
                data: config,
            });
        });
    }

    public async start(): Promise<void> {
        await this.casbinServ.run();
        this.setRouter();
        await new Promise<void>((resolve) => {
            this.listener = this.app.listen(this.requestedPort, () => {
                this.port = (this.listener.address() as AddressInfo).port;
                console.log(`Express server is listening at http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    public terminate(): void {
        this.listener.close();
        console.log('Express server is terminated');
    }
}

export default TestServer;

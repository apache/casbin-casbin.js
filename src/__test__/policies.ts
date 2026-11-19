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

import { readFileSync } from 'fs';

function getPolicies(filename: string): string[][] {
    const ret: string[][] = [];
    const s: string = readFileSync(filename).toString();
    const sArray: string[] = s.split('\n');
    for (const item of sArray) {
        ret.push(item.split(','));
    }
    return ret;
}

export const basicPolicies = getPolicies('src/__test__/examples/basic_policy.csv');
export const rabcPolicies = getPolicies('src/__test__/examples/rbac_policy.csv');
export const abacWithObjRulesPolicies = getPolicies('src/__test__/examples/abac_with_obj_rule_policy.csv');

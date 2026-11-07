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

const basicExample = 'src/__test__/examples/basic_model.conf';
export const basicModelStr = readFileSync(basicExample).toString();

const rbacExample = 'src/__test__/examples/rbac_model.conf';
export const rbacModelStr = readFileSync(rbacExample).toString();

const abacWithObjRuleExample = 'src/__test__/examples/abac_with_obj_rule_policy.csv';
export const abacWithObjRuleModelStr = readFileSync(abacWithObjRuleExample).toString();

const rbacWithDomainsExample = 'src/__test__/examples/rbac_with_domains_model.conf';
export const rbacWithDomainsModelStr = readFileSync(rbacWithDomainsExample).toString();

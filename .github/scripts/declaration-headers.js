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

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
const header = source.slice(0, source.indexOf('*/') + 2) + '\n\n';
if (!header.startsWith('/*') || !header.includes('Licensed to the Apache Software Foundation')) {
    throw new Error('The source license header is missing.');
}

function addDeclarationHeaders(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            addDeclarationHeaders(filename);
        } else if (entry.name.endsWith('.d.ts')) {
            const text = fs.readFileSync(filename, 'utf8');
            if (!text.startsWith(header)) {
                fs.writeFileSync(filename, header + text);
            }
        }
    }
}

addDeclarationHeaders(path.join(root, 'lib'));

import assert from 'node:assert/strict';
import {secureCookies} from './runtime-config.mjs';
assert.equal(secureCookies({}),false);
for(const env of [{NODE_ENV:'production'},{KOYEB_SERVICE_ID:'service'},{RENDER:'true'},{SECURE_COOKIES:'true'}])assert.equal(secureCookies(env),true);
assert.equal(secureCookies({NODE_ENV:'production',SECURE_COOKIES:'false'}),true);
console.log('PASS secure cookie policy for Koyeb, production, Render and local development.');

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(process.env.WALL_SOURCE || new URL('../src/components/wall/WallViewer.tsx',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  function randomUUID(): string {'),source.indexOf('  // Handle migration request'));
function run(crypto) { return vm.runInNewContext('('+fn.replace('(): string','()')+')()', {crypto, Math:{...Math,random:()=>{throw new Error('insecure random fallback invoked');}}}); }
test('session IDs use native crypto UUID when available',()=>assert.equal(run({randomUUID:()=> 'secure-native'}),'secure-native'));
test('session fallback uses secure bytes and sets RFC4122 version and variant bits',()=> {
 let calls=0;
 const id=run({getRandomValues:bytes=>{calls++;bytes.fill(255);return bytes;}});
 assert.equal(calls,1);
 assert.equal(id,'ffffffff-ffff-4fff-bfff-ffffffffffff');
});
test('session UUID fails closed if cryptographic randomness is unavailable',()=>assert.throws(()=>run(undefined),/Cryptographic randomness is required/));

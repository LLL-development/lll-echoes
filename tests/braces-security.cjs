'use strict';
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {test} = require('node:test');
const fork = (name) => path.resolve(__dirname, '../vendor/security', name);
const braces = process.env.BRACES_UNDER_TEST ? require(process.env.BRACES_UNDER_TEST) : require(fork('braces')); 
for (const api of ['parse', 'compile', 'expand', 'stringify']) {
  test(`braces ${api} rejects hostile nesting before recursive work`, () => {
    assert.throws(() => braces[api]('{'.repeat(4000) + 'a,b' + '}'.repeat(4000)), {code: 'ERR_BRACES_LIMIT'});
  });
}
for (const api of ['compile', 'expand', 'stringify']) {
  test(`braces ${api} rejects a cyclic supplied AST`, () => {
    const ast = {type: 'root', nodes: []}; ast.nodes.push(ast);
    assert.throws(() => braces[api](ast), {code: 'ERR_BRACES_LIMIT'});
  });
}
test('braces normal public API remains compatible', () => {
  assert.deepEqual(braces.expand('a/{b,c}/{1..3}'), ['a/b/1','a/b/2','a/b/3','a/c/1','a/c/2','a/c/3']);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
  assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
  assert.deepEqual(braces(['{a,b}', '{x,y}'], {expand:true}), ['a','b','x','y']);
});
test('braces bounds Cartesian products, reverse ranges and repeated AST nodes', () => {
  for (const pattern of ['{a,b}'.repeat(18), '{1000000000..1}', '{1..1000000000}']) {
    assert.throws(() => braces.expand(pattern, {rangeLimit:false}), {code:'ERR_BRACES_LIMIT'});
  }
  const ast = {type:'root', nodes: new Array(100001).fill({type:'text',value:'x'})};
  assert.throws(() => braces.compile(ast), {code:'ERR_BRACES_LIMIT'});
});
test('direct braces helper entrypoints enforce the same bounded contract within a time budget', () => {
  const child = spawnSync(process.execPath, ['-e', `const assert=require('node:assert/strict');const p=${JSON.stringify(process.env.BRACES_UNDER_TEST || fork('braces'))};
    const parse=require(p+'/lib/parse');
    for (const value of ['{'.repeat(4000)+'a,b'+'}'.repeat(4000),'('.repeat(4000)+'x'+')'.repeat(4000),'{'.repeat(4000)]) assert.throws(()=>parse(value), {code:'ERR_BRACES_LIMIT'});
    for(const name of ['compile','expand','stringify']){const fn=require(p+'/lib/'+name);const ast={type:'root',nodes:[]};ast.nodes.push(ast);assert.throws(()=>fn(ast),{code:'ERR_BRACES_LIMIT'});}
    const braces=require(p);assert.throws(()=>braces.expand('{a,b}'.repeat(20)),{code:'ERR_BRACES_LIMIT'});
    assert.deepEqual(braces.expand('{5..1}'),['5','4','3','2','1']);`], {timeout:1500, encoding:'utf8'});
  assert.equal(child.error,undefined,'direct helpers must terminate promptly');assert.equal(child.status,0,child.stderr);
});

test('both transitive consumers resolve the exact patched fork after clean installation', () => {
  const {createRequire} = require('node:module');
  const installed = require('braces');
  assert.equal(installed, braces);
  for (const consumer of ['chokidar', 'micromatch']) {
    const consumerRequire=createRequire(require.resolve(consumer));
    assert.equal(consumerRequire('braces'), installed, consumer+' uses the guarded source');
  }
  const micromatch=require('micromatch');
  assert.deepEqual(micromatch(['src/a.ts','src/b.js','test/c.ts'],'src/*.{ts,js}'),['src/a.ts','src/b.js']);
});

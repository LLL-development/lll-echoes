'use strict';
// Local security fork: bound recursive walkers and allocation before work starts.
const MAX_DEPTH = 128;
const MAX_NODES = 10000;
const MAX_RESULTS = 10000;
const MAX_OUTPUT = 1024 * 1024;
const fail = () => {
  const error = new RangeError('Brace pattern exceeds the security resource limit');
  error.code = 'ERR_BRACES_LIMIT';
  throw error;
};
const checkAst = ast => {
  const pending = [{node: ast, parent: undefined, depth: 0}];
  const seen = new WeakSet();
  let count = 0;
  let size = 0;
  while (pending.length) {
    const {node, parent, depth} = pending.pop();
    if (!node || typeof node !== 'object' || seen.has(node) || depth > MAX_DEPTH || ++count > MAX_NODES) fail();
    seen.add(node);
    if (node.value !== undefined && typeof node.value !== 'string') fail();
    if (parent !== undefined && node.parent !== undefined && node.parent !== parent) fail();
    if (typeof node.value === 'string' && (size += node.value.length) > MAX_OUTPUT) fail();
    if (node.nodes) {
      if (!Array.isArray(node.nodes) || node.nodes.length + count > MAX_NODES) fail();
      for (let i = node.nodes.length - 1; i >= 0; --i) pending.push({node: node.nodes[i], parent: node, depth: depth + 1});
    }
  }
};
module.exports = {MAX_DEPTH, MAX_NODES, MAX_RESULTS, MAX_OUTPUT, fail, checkAst};

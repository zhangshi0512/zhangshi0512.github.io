#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '..', 'data', 'knowledge-constellation.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(manifest.schemaVersion === 1, 'schemaVersion must be 1');
check(Array.isArray(manifest.nodes), 'nodes must be an array');
check(Array.isArray(manifest.edges), 'edges must be an array');
check(manifest.nodes.length > 0 && manifest.nodes.length <= 32, 'node count must be between 1 and 32');
check(manifest.edges.length <= 40, 'edge count must not exceed 40');

const ids = new Set();
for (const node of manifest.nodes) {
  const prefix = `node ${node && node.id ? node.id : '<missing id>'}`;
  check(node && typeof node.id === 'string' && /^[a-z0-9-]+$/.test(node.id), `${prefix}: id must be lowercase kebab-case`);
  check(!ids.has(node.id), `${prefix}: duplicate id`);
  ids.add(node.id);
  check(['domain', 'subtopic'].includes(node.kind), `${prefix}: kind must be domain or subtopic`);
  check(typeof node.label === 'string' && node.label.length > 0 && node.label.length <= 32, `${prefix}: label must be 1–32 characters`);
  check(typeof node.summary === 'string' && node.summary.length > 0 && node.summary.length <= 140, `${prefix}: summary must be 1–140 characters`);
  check(typeof node.query === 'string' && node.query.length > 0 && node.query.length <= 220, `${prefix}: query must be 1–220 characters`);
  check(Number.isFinite(node.articleCount) && node.articleCount >= 0, `${prefix}: articleCount must be non-negative`);
  check(node.layout && Number.isFinite(node.layout.x) && node.layout.x >= 0 && node.layout.x <= 1, `${prefix}: layout.x must be between 0 and 1`);
  check(node.layout && Number.isFinite(node.layout.y) && node.layout.y >= 0 && node.layout.y <= 1, `${prefix}: layout.y must be between 0 and 1`);
  if (node.kind === 'domain') check(Number.isFinite(node.weight) && node.weight > 0 && node.weight <= 1, `${prefix}: domain weight must be in (0, 1]`);
}

for (const edge of manifest.edges) {
  const prefix = `edge ${edge && edge.source ? edge.source : '<missing>'} → ${edge && edge.target ? edge.target : '<missing>'}`;
  check(edge && ids.has(edge.source), `${prefix}: source must reference a node`);
  check(edge && ids.has(edge.target), `${prefix}: target must reference a node`);
  check(edge && edge.source !== edge.target, `${prefix}: self edges are not allowed`);
  check(edge && edge.kind === 'taxonomy', `${prefix}: V1 edges must be taxonomy edges`);
  check(edge && Number.isFinite(edge.strength) && edge.strength > 0 && edge.strength <= 1, `${prefix}: strength must be in (0, 1]`);
}

if (errors.length) {
  console.error('Knowledge constellation manifest is invalid:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const domains = manifest.nodes.filter(node => node.kind === 'domain').length;
  console.log(`Knowledge constellation manifest is valid: ${manifest.nodes.length} nodes, ${manifest.edges.length} edges, ${domains} domains.`);
}

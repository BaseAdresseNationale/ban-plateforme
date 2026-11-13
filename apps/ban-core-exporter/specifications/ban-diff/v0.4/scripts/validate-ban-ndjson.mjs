#!/usr/bin/env node
import fs from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/validate-ban-ndjson.mjs <file.ndjson>");
const lines = fs.readFileSync(path, "utf8").trim().split(/\r?\n/).map((line, index) => {
  try { return JSON.parse(line); } catch { throw new Error(`Invalid JSON at line ${index + 1}`); }
});
if (lines.length < 2) throw new Error("A stream requires start and end lines");
const start = lines[0].meta;
const end = lines.at(-1).meta;
if (start?.note !== "stream-start") throw new Error("First line must be stream-start");
if (end?.note !== "stream-end") throw new Error("Last line must be stream-end");
if (start.format !== 'ban-standard') throw new Error('Only ban-standard is supported');
if (start.formatVersion !== '0.4') throw new Error('Expected formatVersion 0.4');
if (!['full', 'diff'].includes(start.exportType)) throw new Error('Invalid exportType');
const diff = start.exportType === "diff";
const request = start.request;
if (!request || typeof request !== 'object') throw new Error('Stream requires request metadata');
// Preserve PostgreSQL microseconds when checking short diff windows.
const instant = value => {
  const match = typeof value === 'string' && value.match(/^(.*?:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) throw new Error('Expected RFC 3339 date-time with at most six fractional digits');
  const millis = Date.parse(match[1] + match[3]);
  if (!Number.isFinite(millis)) throw new Error('Invalid date-time');
  return BigInt(millis) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'));
};
if (diff && !(instant(request.from) < instant(request.to))) throw new Error("DIFF requires from < to");
if (!diff) instant(request.at);
const body = lines.slice(1, -1);
const seen = new Set();
const selected = request.dataTypes;
if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length) throw new Error('Invalid selected types');
const allowed = ['address','toponym','district'];
if (selected.some(type => !allowed.includes(type))) throw new Error('Unknown selected type');
const counts = Object.fromEntries(selected.map(type => [type, diff ? {count:0,created:0,updated:0,disabled:0} : {count:0}]));
for (const [offset, row] of body.entries()) {
  const line = offset + 2;
  const type = row.type;
  if (!Object.hasOwn(counts, type)) throw new Error(`Unrequested type at line ${line}`);
  const data = row.data;
  if (!type || data === undefined) throw new Error(`Missing type/data at line ${line}`);
  const states = diff ? data : [data];
  const idKey = 'id';
  for (const state of states) {
    if (!state || !state[idKey]) throw new Error(`Object does not match type ${type} at line ${line}`);
    if (!diff && state.status !== "active") throw new Error(`Full state must be active at line ${line}`);
    if (type === 'address' && (!state.districtID || !state.mainToponymID)) throw new Error(`Address payload is incomplete at line ${line}`);
    if (type === 'toponym' && !state.districtID) throw new Error(`Toponym payload is incomplete at line ${line}`);
  }
  if (diff) {
    const event = row.event;
    if (!["created", "updated", "disabled"].includes(event)) throw new Error(`Invalid event at line ${line}`);
    const expected = event === "updated" ? 2 : 1;
    if (!Array.isArray(data) || data.length !== expected) throw new Error(`Invalid data cardinality at line ${line}`);
    if (event === "created" && !["active", "disabled"].includes(states[0].status)) throw new Error(`Invalid created state status at line ${line}`);
    if (event === "disabled" && states[0].status !== "disabled") throw new Error(`Disabled state must be disabled at line ${line}`);
    const id = states[0][idKey];
    const key = `${type}:${id}`;
    if (seen.has(key)) throw new Error(`Duplicate object in DIFF: ${key}`);
    seen.add(key);
    counts[type] ??= {count:0,created:0,updated:0,disabled:0}; counts[type].count++; counts[type][event]++;
  } else { counts[type] ??= {count:0}; counts[type].count++; }
}
const declared = end.stats;
// Object property order is irrelevant, but every selected type/counter is required.
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value ?? {}).sort().map(([key,counters]) =>
  [key,Object.fromEntries(Object.entries(counters ?? {}).sort())])));
if (canonical(counts) !== canonical(declared)) throw new Error(`Stats mismatch: calculated ${JSON.stringify(counts)}`);
console.log(`OK ${path}: ${body.length} data lines`);

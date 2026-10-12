#!/usr/bin/env node
import fs from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/validate-ban-ndjson.mjs <file.ndjson>");
const lines = fs.readFileSync(path, "utf8").trim().split(/\r?\n/).map((line, index) => {
  try { return JSON.parse(line); } catch { throw new Error(`Invalid JSON at line ${index + 1}`); }
});
if (lines.length < 2) throw new Error("A stream requires start and end lines");
const fr = Object.hasOwn(lines[0], "metadonnees");
const metaKey = fr ? "metadonnees" : "meta";
const dataKey = fr ? "donnees" : "data";
const eventKey = fr ? "evenement" : "event";
const start = lines[0][metaKey];
const end = lines.at(-1)[metaKey];
if (start?.note !== "stream-start") throw new Error("First line must be stream-start");
if (end?.note !== "stream-end") throw new Error("Last line must be stream-end");
const diff = (fr ? start.typeExport : start.exportType) === "diff";
const request = fr ? start.requete : start.request;
if (!request || typeof request !== 'object') throw new Error('Stream requires request metadata');
// Preserve PostgreSQL microseconds when checking short diff windows.
const instant = value => {
  const match = typeof value === 'string' && value.match(/^(.*?:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) throw new Error('Expected RFC 3339 date-time with at most six fractional digits');
  const millis = Date.parse(match[1] + match[3]);
  if (!Number.isFinite(millis)) throw new Error('Invalid date-time');
  return BigInt(millis) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'));
};
if (diff && !(instant(fr ? request.de : request.from) < instant(fr ? request.a : request.to))) throw new Error("DIFF requires from < to");
const body = lines.slice(1, -1);
const seen = new Set();
const selected = fr ? request.typesDonnees : request.dataTypes;
if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length) throw new Error('Invalid selected types');
const allowed = fr ? ['adresse','odonyme','commune'] : ['address','toponym','district'];
if (selected.some(type => !allowed.includes(type))) throw new Error('Unknown selected type');
const counts = Object.fromEntries(selected.map(type => [type, diff ? {count:0,created:0,updated:0,disabled:0} : {count:0}]));
for (const [offset, row] of body.entries()) {
  const line = offset + 2;
  const type = row.type;
  if (!Object.hasOwn(counts, type)) throw new Error(`Unrequested type at line ${line}`);
  const data = row[dataKey];
  if (!type || data === undefined) throw new Error(`Missing type/data at line ${line}`);
  const states = diff ? data : [data];
  const idKey = fr ? ({commune:"idCommune",odonyme:"idOdonyme",adresse:"idAdresse"}[type]) : "id";
  for (const state of states) {
    if (!state || !state[idKey]) throw new Error(`Object does not match type ${type} at line ${line}`);
    if (!diff && state[fr ? "statut" : "status"] !== "active") throw new Error(`Full state must be active at line ${line}`);
    const districtKey = fr ? "idCommune" : "districtID";
    const toponymKey = fr ? "idOdonyme" : "mainToponymID";
    if ((type === "address" || type === "adresse") && (!state[districtKey] || !state[toponymKey])) throw new Error(`Address payload is incomplete at line ${line}`);
    if ((type === "toponym" || type === "odonyme") && !state[districtKey]) throw new Error(`Toponym payload is incomplete at line ${line}`);
  }
  if (diff) {
    const event = row[eventKey];
    if (!["created", "updated", "disabled"].includes(event)) throw new Error(`Invalid event at line ${line}`);
    const expected = event === "updated" ? 2 : 1;
    if (!Array.isArray(data) || data.length !== expected) throw new Error(`Invalid data cardinality at line ${line}`);
    if (event === "created" && !["active", "disabled"].includes(states[0][fr ? "statut" : "status"])) throw new Error(`Invalid created state status at line ${line}`);
    if (event === "disabled" && states[0][fr ? "statut" : "status"] !== "disabled") throw new Error(`Disabled state must be disabled at line ${line}`);
    const id = states[0][idKey];
    const key = `${type}:${id}`;
    if (seen.has(key)) throw new Error(`Duplicate object in DIFF: ${key}`);
    seen.add(key);
    counts[type] ??= {count:0,created:0,updated:0,disabled:0}; counts[type].count++; counts[type][event]++;
  } else { counts[type] ??= {count:0}; counts[type].count++; }
}
const declared = fr ? end.statistiques : end.stats;
// Object property order is irrelevant, but every selected type/counter is required.
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value ?? {}).sort().map(([key,counters]) =>
  [key,Object.fromEntries(Object.entries(counters ?? {}).sort())])));
if (canonical(counts) !== canonical(declared)) throw new Error(`Stats mismatch: calculated ${JSON.stringify(counts)}`);
console.log(`OK ${path}: ${body.length} data lines`);

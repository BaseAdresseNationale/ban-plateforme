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
if (diff && !(Date.parse(fr ? start.de : start.from) < Date.parse(fr ? start.a : start.to))) throw new Error("DIFF requires from < to");
const body = lines.slice(1, -1);
const seen = new Set();
const counts = {};
for (const [offset, row] of body.entries()) {
  const line = offset + 2;
  const type = row.type;
  const data = row[dataKey];
  if (!type || data === undefined) throw new Error(`Missing type/data at line ${line}`);
  const states = diff ? data : [data];
  const idKey = fr ? ({commune:"idCommune",odonyme:"idOdonyme",adresse:"idAdresse"}[type]) : "id";
  for (const state of states) {
    if (!state || !state[idKey]) throw new Error(`Object does not match type ${type} at line ${line}`);
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
    if (event === "created" && states[0][fr ? "statut" : "status"] !== "active") throw new Error(`Created state must be active at line ${line}`);
    if (event === "disabled" && states[0][fr ? "statut" : "status"] !== "disabled") throw new Error(`Disabled state must be disabled at line ${line}`);
    const id = states[0][idKey];
    const key = `${type}:${id}`;
    if (seen.has(key)) throw new Error(`Duplicate object in DIFF: ${key}`);
    seen.add(key);
    counts[type] ??= {count:0,created:0,updated:0,disabled:0}; counts[type].count++; counts[type][event]++;
  } else { counts[type] ??= {count:0}; counts[type].count++; }
}
const declared = fr ? end.statistiques : end.stats;
if (JSON.stringify(counts) !== JSON.stringify(declared)) throw new Error(`Stats mismatch: calculated ${JSON.stringify(counts)}`);
console.log(`OK ${path}: ${body.length} data lines`);

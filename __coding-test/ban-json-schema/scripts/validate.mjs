import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const common = readJson(path.resolve("schemas/common.defs.schema.json"));
ajv.addSchema(common);

const schemaPath = process.argv[2];
const dataPath = process.argv[3];

if (!schemaPath || !dataPath) {
  console.error("Usage: node scripts/validate.mjs <schema.json> <data.json>");
  process.exit(2);
}

const schema = readJson(path.resolve(schemaPath));
const validate = ajv.compile(schema);

const data = readJson(path.resolve(dataPath));
const ok = validate(data);

if (!ok) {
  console.error("❌ Invalid");
  for (const err of validate.errors ?? []) console.error("-", err.instancePath, err.message);
  process.exit(1);
}

console.log("✅ Valid");

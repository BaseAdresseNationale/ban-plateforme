// Entirely synthetic scenario, unrelated to the real municipality/event inventory.
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const start = '2026-01-01T00:00:00Z', change = '2026-03-01T00:00:00Z';
const range = (from = start, to = null) => `["${from}",${to ? `"${to}"` : ''})`;
const meta = { insee: { cog: '96001' }, source: 'synthetic-test' };
const labels = [{ isoCode: 'fra', value: 'Objet synthétique' }];
const district = { id: id(1), labels, updateDate: start, config: {}, meta, range_validity: range(), isActive: true };
const top = n => ({ id: id(n), districtID: id(1), labels, geometry: { type: 'Point', coordinates: [2, 48] },
  updateDate: start, meta, range_validity: range(), isActive: true });
const address = (n, extra = {}) => ({ id: id(n), mainCommonToponymID: id(2), secondaryCommonToponymIDs: [id(3)],
  districtID: id(1), number: n, suffix: '', labels, certified: false, positions: [], updateDate: start,
  meta, range_validity: range(), isActive: true, ...extra });
export const rows = {
  district: [district], district_h: [], common_toponym: [top(2), top(3)], common_toponym_h: [],
  address: [address(4, { range_validity: range('2026-02-01T00:00:00Z'), updateDate: '2026-02-01T00:00:00Z' }),
    address(5, { number: 55, range_validity: range(change), updateDate: change }),
    address(6, { isActive: false, range_validity: range(change), updateDate: change }), address(7)],
  address_h: [address(5, { range_validity: range(start, change) }), address(6, { range_validity: range(start, change) })],
};
export const syntheticIds = { district: id(1), toponym: id(2), secondary: id(3), created: id(4), updated: id(5), disabled: id(6), stable: id(7), absent: id(99) };
export function seedSql() {
  let sql = 'BEGIN;\n';
  for (const t of ['district', 'common_toponym', 'address']) sql += `ALTER TABLE ban.${t} DISABLE TRIGGER test_historisation;\n`;
  for (const t of ['district', 'common_toponym', 'address', 'district_h', 'common_toponym_h', 'address_h']) {
    sql += `INSERT INTO ban.${t} SELECT * FROM jsonb_populate_recordset(NULL::ban.${t}, $data$${JSON.stringify(rows[t])}$data$::jsonb);\n`;
  }
  for (const t of ['district', 'common_toponym', 'address']) sql += `ALTER TABLE ban.${t} ENABLE TRIGGER test_historisation;\n`;
  return sql + 'COMMIT;\n';
}

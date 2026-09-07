const { randomUUID } = require('crypto');

/**
 * A small in-memory stand-in for @prisma/client, used only in tests. It
 * exists because this sandbox's network egress does not reach Prisma's
 * engine binary CDN, so `prisma generate`/a real Postgres connection are
 * not available here - see docs/TESTING.md. It implements exactly the
 * query shapes this project's own repositories issue (checked by
 * grepping src/ for every `prisma.<model>.<method>` call), not a general
 * Prisma reimplementation.
 *
 * Every test gets its own createFakePrisma() instance, so state never
 * leaks between test files or test cases.
 */

function matchesWhere(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((sub) => matchesWhere(row, sub));
    if (key === 'AND') return cond.every((sub) => matchesWhere(row, sub));
    if (key === 'NOT') return !matchesWhere(row, cond);

    // Composite unique keys, e.g. organizationId_employeeCode: { organizationId, employeeCode }
    if (cond && typeof cond === 'object' && !('in' in cond) && !('gte' in cond) && !('lte' in cond) && !('lt' in cond) && !('gt' in cond) && !('not' in cond) && !('equals' in cond)) {
      return Object.entries(cond).every(([subKey, subVal]) => row[subKey] === subVal);
    }
    if (cond && typeof cond === 'object' && 'in' in cond) return cond.in.includes(row[key]);
    if (cond && typeof cond === 'object' && 'gte' in cond) return row[key] >= cond.gte;
    if (cond && typeof cond === 'object' && 'lte' in cond) return row[key] <= cond.lte;
    if (cond && typeof cond === 'object' && 'lt' in cond) return row[key] < cond.lt;
    if (cond && typeof cond === 'object' && 'gt' in cond) return row[key] > cond.gt;
    if (cond && typeof cond === 'object' && 'not' in cond) return row[key] !== cond.not;
    if (cond && typeof cond === 'object' && 'equals' in cond) return row[key] === cond.equals;
    if (cond === null) return row[key] === null || row[key] === undefined;
    return row[key] === cond;
  });
}

function applyInclude(store, modelName, row, include) {
  if (!row || !include) return row;
  const relations = store.relations[modelName] || {};
  const out = { ...row };
  for (const [relName, relSpec] of Object.entries(include)) {
    if (!relSpec) continue;
    const rel = relations[relName];
    if (!rel) continue;
    const related = rel.many
      ? store.db[rel.model].filter((r) => r[rel.foreignKey] === row.id)
      : store.db[rel.model].find((r) => r.id === row[rel.foreignKey]) || null;
    const nestedInclude = typeof relSpec === 'object' ? relSpec.include : undefined;
    out[relName] = nestedInclude
      ? Array.isArray(related)
        ? related.map((r) => applyInclude(store, rel.model, r, nestedInclude))
        : applyInclude(store, rel.model, related, nestedInclude)
      : related;
  }
  return out;
}

function makeModel(store, name) {
  return {
    async findUnique({ where, include }) {
      const row = store.db[name].find((r) => matchesWhere(r, where));
      return row ? applyInclude(store, name, row, include) : null;
    },
    async findFirst({ where, include } = {}) {
      const row = store.db[name].find((r) => matchesWhere(r, where));
      return row ? applyInclude(store, name, row, include) : null;
    },
    async findMany({ where, orderBy, skip = 0, take, include } = {}) {
      let rows = store.db[name].filter((r) => matchesWhere(r, where));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        rows = [...rows].sort((a, b) => (a[field] > b[field] ? 1 : -1) * (dir === 'desc' ? -1 : 1));
      }
      rows = rows.slice(skip, take ? skip + take : undefined);
      return rows.map((r) => applyInclude(store, name, r, include));
    },
    async count({ where } = {}) {
      return store.db[name].filter((r) => matchesWhere(r, where)).length;
    },
    async create({ data }) {
      const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
      if (name === 'activationCode' && !row.status) row.status = 'ACTIVE';
      store.db[name].push(row);
      return row;
    },
    async update({ where, data }) {
      const row = store.db[name].find((r) => matchesWhere(r, where));
      if (!row) throw Object.assign(new Error(`No ${name} found to update`), { code: 'P2025' });
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    async updateMany({ where, data }) {
      const rows = store.db[name].filter((r) => matchesWhere(r, where));
      rows.forEach((r) => Object.assign(r, data, { updatedAt: new Date() }));
      return { count: rows.length };
    },
    async upsert({ where, create, update }) {
      const row = store.db[name].find((r) => matchesWhere(r, where));
      if (row) {
        Object.assign(row, update, { updatedAt: new Date() });
        return row;
      }
      const created = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create };
      store.db[name].push(created);
      return created;
    },
    async groupBy({ by, where, _count }) {
      const rows = store.db[name].filter((r) => matchesWhere(r, where));
      const groups = new Map();
      for (const row of rows) {
        const key = by.map((f) => row[f]).join('|');
        if (!groups.has(key)) groups.set(key, { row, count: 0 });
        groups.get(key).count += 1;
      }
      return [...groups.values()].map((g) => {
        const out = {};
        by.forEach((f) => (out[f] = g.row[f]));
        out._count = { _all: g.count };
        return out;
      });
    },
  };
}

function createFakePrisma() {
  const store = {
    db: {
      organization: [],
      orgAdmin: [],
      employee: [],
      device: [],
      deviceToken: [],
      zohoConnection: [],
      agentEnrollment: [],
      activitySyncLog: [],
      auditLog: [],
      organizationSettings: [],
      activationCode: [],
    },
    // Every model's relations live in one shared registry, keyed by model
    // name, so applyInclude can look up the correct map at each level of
    // a nested include instead of staying bound to whichever model the
    // query started from.
    relations: {
      device: { employee: { model: 'employee', foreignKey: 'employeeId' } },
      deviceToken: { device: { model: 'device', foreignKey: 'deviceId' } },
      activitySyncLog: { device: { model: 'device', foreignKey: 'deviceId' } },
      activationCode: {
        organization: { model: 'organization', foreignKey: 'organizationId' },
        employee: { model: 'employee', foreignKey: 'employeeId' },
      },
    },
  };

  const client = {
    organization: makeModel(store, 'organization'),
    orgAdmin: makeModel(store, 'orgAdmin'),
    employee: makeModel(store, 'employee'),
    device: makeModel(store, 'device'),
    deviceToken: makeModel(store, 'deviceToken'),
    zohoConnection: makeModel(store, 'zohoConnection'),
    agentEnrollment: makeModel(store, 'agentEnrollment'),
    activitySyncLog: makeModel(store, 'activitySyncLog'),
    auditLog: makeModel(store, 'auditLog'),
    organizationSettings: makeModel(store, 'organizationSettings'),
    activationCode: makeModel(store, 'activationCode'),
    $queryRaw: async () => [{ '?column?': 1 }],
    $connect: async () => {},
    $disconnect: async () => {},
    $on: () => {},
    __store: store, // test-only escape hatch for seeding/inspecting state directly
  };

  return client;
}

module.exports = { createFakePrisma };

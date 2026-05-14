/**
 * Build `users.org_snapshot` JSON from JKSPulse hierarchy picker (same shape as LDAP sync enrichment).
 * @param {object|null|undefined} pulseOrg - `{ division?, department?, section? }` with `{ id, name }` entities
 * @returns {object|null}
 */
export const buildOrgSnapshotFromPulsePicker = (pulseOrg) => {
  if (!pulseOrg || typeof pulseOrg !== "object") {
    return null;
  }

  const norm = (entity) => {
    if (!entity || typeof entity !== "object") {
      return null;
    }
    const id = String(entity.id ?? "").trim();
    const name = String(entity.name ?? "").trim();
    if (!id && !name) {
      return null;
    }
    const row = {};
    if (id) {
      row.id = id;
    }
    if (name) {
      row.name = name;
    }
    if (entity.code != null && String(entity.code).trim() !== "") {
      row.code = String(entity.code).trim();
    }
    return row;
  };

  const division = norm(pulseOrg.division);
  const department = norm(pulseOrg.department);
  const section = norm(pulseOrg.section);

  if (!division && !department && !section) {
    return null;
  }

  return {
    source: "jkspulse",
    division,
    department,
    section,
    matchedBy: "manual",
    confidence: "manual"
  };
};

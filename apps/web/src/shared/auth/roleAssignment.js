/**
 * Mirror of apps/api/src/shared/auth/roleAssignment.js — keep rules aligned.
 */

export const ROLE_RANK = {
  requester: 0,
  it: 1,
  admin: 2,
  head_it: 3,
  dev: 4
};

export const ASSIGNABLE_ROLES = ["requester", "it", "admin", "head_it"];

const ASSIGNABLE_BY_ACTOR = {
  dev: new Set(["requester", "it", "admin", "head_it"]),
  head_it: new Set(["admin", "it"]),
  admin: new Set(["admin", "it"]),
  it: new Set(["requester"])
};

export const getAssignableRoles = (actorRole) => {
  const set = ASSIGNABLE_BY_ACTOR[actorRole];
  return set ? [...set] : [];
};

export const assertCanAssignRole = (actor, targetUser, newRole) => {
  if (!actor?.role || !targetUser?.role) {
    return { ok: false, detail: "Missing actor or target user." };
  }

  if (newRole === "dev" || !ASSIGNABLE_ROLES.includes(newRole)) {
    return { ok: false, detail: "Invalid role." };
  }

  const allowed = ASSIGNABLE_BY_ACTOR[actor.role];
  if (!allowed || !allowed.has(newRole)) {
    return { ok: false, detail: "Your role cannot assign this access level." };
  }

  const actorRank = ROLE_RANK[actor.role];
  const targetRank = ROLE_RANK[targetUser.role];
  const newRank = ROLE_RANK[newRole];

  if (actorRank === undefined || targetRank === undefined || newRank === undefined) {
    return { ok: false, detail: "Unknown role in hierarchy." };
  }

  if (targetRank > actorRank) {
    return { ok: false, detail: "You cannot change roles for users above your level." };
  }

  if (newRank > actorRank) {
    return { ok: false, detail: "You cannot grant a role above your own." };
  }

  return { ok: true };
};

export const canActorAssignRole = (actor, targetUser, newRole) =>
  assertCanAssignRole(actor, targetUser, newRole).ok;

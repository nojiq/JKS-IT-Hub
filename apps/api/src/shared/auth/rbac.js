/**
 * Centralized RBAC (Role-Based Access Control) helpers
 */

export const ROLES = {
    IT: 'it',
    ADMIN: 'admin',
    HEAD_IT: 'head_it',
    REQUESTER: 'requester'
};

export const ROLE_GROUPS = {
    IT_STAFF: [ROLES.IT, ROLES.ADMIN, ROLES.HEAD_IT],
    ADMIN_STAFF: [ROLES.ADMIN, ROLES.HEAD_IT],
    ALL: [ROLES.IT, ROLES.ADMIN, ROLES.HEAD_IT, ROLES.REQUESTER]
};

/**
 * Check if a user has an IT role
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const hasItRole = (user) => {
    return user && ROLE_GROUPS.IT_STAFF.includes(user.role);
};

/**
 * Check if a user has an admin role
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const hasAdminRole = (user) => {
    return user && ROLE_GROUPS.ADMIN_STAFF.includes(user.role);
};

/**
 * Check if a user has a specific role
 * @param {Object} user - User object with role property
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export const hasRole = (user, role) => {
    return user && user.role === role;
};

/**
 * Check if a user has any of the specified roles
 * @param {Object} user - User object with role property
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean}
 */
export const hasAnyRole = (user, roles) => {
    return user && roles.includes(user.role);
};

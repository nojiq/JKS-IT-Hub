import { fetchUsers } from '../../users/users-api.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

const getLdapValue = (ldapFields, candidates = []) => {
    if (!ldapFields || typeof ldapFields !== 'object') return '';

    const entries = Object.entries(ldapFields);
    for (const candidate of candidates) {
        const directValue = ldapFields[candidate];
        if (directValue !== undefined && directValue !== null && String(directValue).trim()) {
            return directValue;
        }

        const match = entries.find(([key]) => normalize(key) === normalize(candidate));
        if (match?.[1] !== undefined && match[1] !== null && String(match[1]).trim()) {
            return match[1];
        }
    }

    return '';
};

export const getUserDepartment = (user) => (
    user?.orgSnapshot?.department?.name ||
    getLdapValue(user?.ldapFields, ['department', 'departmentName', 'dept']) ||
    ''
);

export const getUserDisplayName = (user) => (
    user?.displayName ||
    getLdapValue(user?.ldapFields, ['displayName', 'cn', 'name']) ||
    user?.username ||
    ''
);

export const isItDepartmentUser = (user) => normalize(getUserDepartment(user)) === 'it';

export const fetchActiveItDepartmentUsers = async () => {
    const result = await fetchUsers({ status: 'active' });
    const users = result.users || result || [];

    return users
        .filter(isItDepartmentUser)
        .map((user) => ({
            ...user,
            displayName: getUserDisplayName(user)
        }));
};

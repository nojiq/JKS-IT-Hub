/** Side-effect module: must be the first import in API tests that load Prisma. */
process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";
process.env.LDAP_URL ??= "ldaps://example.com:636";
process.env.LDAP_BASE_DN ??= "dc=example,dc=com";
process.env.LDAP_BIND_DN ??= "cn=bind-user,dc=example,dc=com";
process.env.LDAP_BIND_PASSWORD ??= "secret-password";
process.env.LDAP_USER_FILTER ??= "(uid={{username}})";
process.env.LDAP_SYNC_FILTER ??= "(objectClass=person)";
process.env.LDAP_SYNC_ATTRIBUTES ??= "uid,mail";
process.env.LDAP_SYNC_USERNAME_ATTRIBUTE ??= "uid";
process.env.JWT_SECRET ??= "test-jwt-secret-test-jwt-secret-test-jwt-secret";
process.env.JWT_ISSUER ??= "it-hub";
process.env.JWT_AUDIENCE ??= "it-hub-web";
process.env.JWT_EXPIRES_IN ??= "12h";

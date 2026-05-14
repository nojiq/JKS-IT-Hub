/** Side-effect module: must be the first import in API tests that load Prisma. */
process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";
process.env.JWT_SECRET ??= "test-jwt-secret-test-jwt-secret-test-jwt-secret";

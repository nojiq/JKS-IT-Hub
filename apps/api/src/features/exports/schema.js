import { z } from 'zod';

const userIdSchema = z.string().uuid('Invalid userId format');

const exportUserCredentialsParamsSchema = z.object({
  userId: userIdSchema
});

export { exportUserCredentialsParamsSchema };

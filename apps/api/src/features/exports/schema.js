import { z } from 'zod';

import { FORMAT_TYPES } from './config.js';

const userIdSchema = z.string().uuid('Invalid userId format');

const formatTypeSchema = z.nativeEnum(FORMAT_TYPES).default(FORMAT_TYPES.STANDARD);

const exportUserCredentialsParamsSchema = z.object({
  userId: userIdSchema,
  format: formatTypeSchema
});

const batchExportSchema = z.object({
  userIds: z.array(z.string().uuid('Invalid userId format'))
    .min(1, 'At least one user is required')
    .max(100, 'Cannot export more than 100 users at once'),
  format: formatTypeSchema
});

export { exportUserCredentialsParamsSchema, batchExportSchema, formatTypeSchema };

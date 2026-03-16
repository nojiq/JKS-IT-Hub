import { getDatabaseOptions } from './apps/api/src/shared/db/prisma.js';

export default {
    datasources: {
        db: getDatabaseOptions()
    }
};

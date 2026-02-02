import { createSyncJob } from "./syncJob.js";
import { createLdapSyncRunner } from "./syncService.js";
// We need to import dependencies/repos here or assume they are passed in fastify.
// Typically feature index.js is a plugin.

export default async function ldapFeature(fastify, options) {
    // We assume repos/services are available or created here.
    // For now, let's just wire up what we have.

    // Dependency injection would normally happen here or at app level.
    // Let's assume `syncService` needs to be constructed.

    // Placeholder for repos (in a real app these come from plugins or decorators)
    // Verify critical dependencies
    if (!fastify.userRepo || !fastify.syncRepo) {
        throw new Error("LDAP Feature Missing Dependencies: userRepo or syncRepo not registered");
    }

    const { userRepo, syncRepo, auditRepo, ldapService } = fastify;

    // If syncService is not available, we construct it
    const syncRunner = createLdapSyncRunner({
        config: fastify.config,
        ldapService: ldapService || {}, // Mock/Placeholder allowed for service, but repos should exist
        syncRepo: syncRepo,
        userRepo: userRepo,
        auditRepo: auditRepo || {},
        eventChannel: null
    });

    const job = createSyncJob({
        syncService: syncRunner,
        logger: fastify.log,
        config: fastify.config
    });

    // Register job with scheduler
    // fastify.scheduler is added by @fastify/schedule
    if (fastify.scheduler) {
        fastify.scheduler.addSimpleIntervalJob(job);
        fastify.log.info("LDAP Scheduled Sync Job registered");
    } else {
        fastify.log.warn("Scheduler not available, LDAP sync job NOT registered");
    }
}

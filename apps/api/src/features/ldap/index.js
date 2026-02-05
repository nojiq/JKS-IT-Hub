import { createSyncJob } from "./syncJob.js";
import { createLdapService } from "./service.js";
import { createLdapSyncEventChannel } from "./syncEvents.js";
import { createLdapSyncRunner } from "./syncService.js";
// We need to import dependencies/repos here or assume they are passed in fastify.
// Typically feature index.js is a plugin.

export default async function ldapFeature(fastify, options) {
    // We assume repos/services are available or created here.
    // For now, let's just wire up what we have.

    // Dependency injection would normally happen here or at app level.
    // Let's assume `syncService` needs to be constructed.
    const config = options.config || fastify.config;

    // Placeholder for repos (in a real app these come from plugins or decorators)
    // Dependency injection: Check options first, then fastify instance
    const userRepo = options.userRepo || fastify.userRepo;
    const syncRepo = options.syncRepo || fastify.syncRepo;
    const auditRepo = options.auditRepo || fastify.auditRepo;
    const ldapService =
        options.ldapService ||
        fastify.ldapService ||
        createLdapService(config.ldap);
    const eventChannel =
        options.eventChannel ||
        fastify.ldapSyncEvents ||
        createLdapSyncEventChannel();

    // Verify critical dependencies
    if (!userRepo || !syncRepo) {
        throw new Error("LDAP Feature Missing Dependencies: userRepo or syncRepo not registered in options or fastify instance");
    }

    // If syncService is not available, we construct it
    const syncRunner = createLdapSyncRunner({
        config,
        ldapService,
        syncRepo: syncRepo,
        userRepo: userRepo,
        auditRepo: auditRepo || {},
        eventChannel
    });

    await fastify.register(import("./routes.js"), {
        config,
        userRepo,
        syncRunner,
        syncRepo,
        eventChannel
    });

    const job = createSyncJob({
        syncService: syncRunner,
        logger: fastify.log,
        config
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

import fastifySchedule from "@fastify/schedule";

export default async function schedulerPlugin(fastify, options) {
    // Register the scheduler plugin
    await fastify.register(fastifySchedule);
}

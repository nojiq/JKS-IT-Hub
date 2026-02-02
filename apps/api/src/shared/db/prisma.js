import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";

const getDatabaseOptions = () => {
    let url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL is required to initialize Prisma Client");
    }

    // Remove surrounding quotes if present
    url = url.replace(/^["']|["']$/g, '');

    const parsed = new URL(url);

    return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\/+/, ""),
        connectionLimit: 20,
        // Critical for MySQL 8+ authentication
        allowPublicKeyRetrieval: true
    };
};

export const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(getDatabaseOptions())
});

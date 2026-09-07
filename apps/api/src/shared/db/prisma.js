import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";

const getDatabaseOptions = () => {
    if (process.env.MYSQL_DATABASE || process.env.MYSQL_HOST) {
        return {
            host: process.env.MYSQL_HOST || "localhost",
            port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
            user: process.env.MYSQL_USER || "root",
            password: process.env.MYSQL_PASSWORD ?? "",
            database: process.env.MYSQL_DATABASE || "it_dev",
            connectionLimit: 20,
            // Critical for MySQL 8+ authentication
            allowPublicKeyRetrieval: true
        };
    }

    let url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("Database configuration is missing. Set MYSQL_HOST, MYSQL_DATABASE, etc., or DATABASE_URL");
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

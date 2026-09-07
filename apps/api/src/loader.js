import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

// Construct DATABASE_URL from discrete MySQL env vars if not explicitly set
if (!process.env.DATABASE_URL && (process.env.MYSQL_DATABASE || process.env.MYSQL_HOST)) {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = process.env.MYSQL_PORT || '3306';
    const user = encodeURIComponent(process.env.MYSQL_USER || 'root');
    const password = encodeURIComponent(process.env.MYSQL_PASSWORD || '');
    const database = process.env.MYSQL_DATABASE || 'it_dev';
    process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
}

// Map API_PORT to PORT for fastify-cli to pick it up automatically
if (process.env.API_PORT && !process.env.PORT) {
    process.env.PORT = process.env.API_PORT;
}

// Now import and run the server
const { default: app } = await import('./server.js');
export default app;

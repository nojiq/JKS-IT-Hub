import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

// Map API_PORT to PORT for fastify-cli to pick it up automatically
if (process.env.API_PORT && !process.env.PORT) {
    process.env.PORT = process.env.API_PORT;
}

// Now import and run the server
const { default: app } = await import('./server.js');
export default app;

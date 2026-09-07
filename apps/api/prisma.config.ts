import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig, env } from "prisma/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL && (process.env.MYSQL_DATABASE || process.env.MYSQL_HOST)) {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = process.env.MYSQL_PORT || "3306";
  const user = encodeURIComponent(process.env.MYSQL_USER || "root");
  const password = encodeURIComponent(process.env.MYSQL_PASSWORD || "");
  const database = process.env.MYSQL_DATABASE || "it_dev";
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
}


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js"
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL")
  }
});

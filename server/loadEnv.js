import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo-root .env in local dev; Railway and other PaaS inject vars directly and
// the file will not exist there — that's fine, dotenv silently no-ops.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081'),
  MONGODB_DNS_SERVERS: z.string().default(''),
});

export const config = environmentSchema.parse(process.env);
export const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
export const mongodbDnsServers = config.MONGODB_DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean);
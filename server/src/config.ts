import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('30d'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081'),
  MONGODB_DNS_SERVERS: z.string().default(''),
  // Optional: SMTP connection URL (e.g. smtps://user:pass@smtp.example.com) used to email password-reset codes.
  // Optional: Brevo transactional email API key (https://app.brevo.com/settings/keys/api). MAIL_FROM must be a sender verified in Brevo.
  BREVO_API_KEY: z.string().optional(),
  // Password reset is postponed (see specs/001-bear-care-experience/future_considerations.md); routes exist only when true.
  PASSWORD_RESET_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Bear Care <no-reply@bearcare.invalid>'),
});

export const config = environmentSchema.parse(process.env);
export const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
export const mongodbDnsServers = config.MONGODB_DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean);
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
  
  // Required for Block 1 foundation
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Recognized for future blocks (optional for now)
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  MAKE_WEBHOOK_URL: z.string().optional(),
  MAKE_WEBHOOK_SECRET: z.string().optional(),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment Variable Validation Error:', parseResult.error.format());
  throw new Error('Invalid environment configuration.');
}

export const env = parseResult.data;

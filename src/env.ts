import { z } from "zod";

const PORT = process.env.PORT || "8080";

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).default("8080").transform(Number),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  BASE_URL: z.string().url().default(`http://localhost:${PORT}`),

  PROJECT: z.string(),
  MODEL: z.string().default("gemini-2.5-pro"),
  LOCATION: z.string().default("global"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  AUTH_ALLOWED_DOMAINS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((d) => d.trim()) : [])),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;

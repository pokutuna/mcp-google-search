import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).default("8080").transform(Number),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PROJECT: z.string(),
  MODEL: z.string().default("gemini-2.5-pro"),
  LOCATION: z.string().default("global"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

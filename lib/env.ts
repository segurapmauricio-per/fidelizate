const REQUIRED_VARS = ["AUTH_SECRET", "DATABASE_URL", "NEXTAUTH_URL"] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

export function requireEnv(name: RequiredVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}

export function validateEnvAtStartup(): void {
  for (const name of REQUIRED_VARS) {
    requireEnv(name);
  }
}

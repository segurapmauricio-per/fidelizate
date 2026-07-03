const REQUIRED_VARS = ["AUTH_SECRET", "DATABASE_URL", "NEXTAUTH_URL"] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

export function requireEnv(name: RequiredVar): string {
  const value = process.env[name];
  if (!value) {
    // `next build` ejecuta el import de las rutas para recolectar metadata,
    // pero en ese momento el contenedor de build no siempre recibe las
    // variables de entorno de runtime. No fallar el build por esto: el
    // valor real llega en el contenedor cuando arranca `next start`.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return `build-placeholder-${name}`;
    }
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

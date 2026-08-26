import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yahoo-finance2 und die Prisma-Runtime dürfen nicht ins Server-Bundle gezogen werden:
  // beide laden Dateien/Module dynamisch, was der Bundler nicht auflösen kann.
  serverExternalPackages: ["yahoo-finance2", "@prisma/client", "better-sqlite3"],
};

export default nextConfig;

import { AbstractService } from "./AbstractService";
import { defineService } from "../registry";

export class AuthService extends AbstractService {
  readonly name = "Auth";
}

export const authManifest = defineService({
  name: "Auth",
  description: "Authentication service",
  dependencies: ["Logger", "Network"] as const,
  factory: (deps) => {
    const { Logger, Network } = deps;
    console.log(`[Auth] using ${Logger.name} and ${Network.name}`);
    return new AuthService();
  },
});


import { defineService } from "../../registry";
import { BasicAuthService } from "./BasicAuthService";

const serviceName = "Auth";

export const authManifest = defineService({
  name: serviceName,
  description: "Authentication service",
  dependencies: ["Logger", "Network"],
  factory: (deps) => {
    const { Logger, Network } = deps;
    console.log(`[${serviceName}] using ${Logger.name} and ${Network.name}`);
    return new BasicAuthService(serviceName);
  },
});

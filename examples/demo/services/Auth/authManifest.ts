import { defineService } from "../../../../src";
import { BasicAuthService } from "./BasicAuthService";

const serviceName = "Auth";

export const authManifest = defineService({
  name: serviceName,
  dependencies: ["Logger", "Network"],
  factory: (deps) => {
    const { Logger, Network } = deps;
    return new BasicAuthService(serviceName, Logger, Network);
  },
});

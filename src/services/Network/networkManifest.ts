import { defineService } from "../../registry";
import { BasicNetworkService } from "./BasicNetworkService";

const serviceName = "Network";

export const networkManifest = defineService({
  name: serviceName,
  dependencies: ["Logger", "Storage"],
  factory: (deps) => {
    const { Logger, Storage } = deps;
    return new BasicNetworkService(serviceName, Logger, Storage);
  },
});

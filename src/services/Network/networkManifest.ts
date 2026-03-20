import { defineService } from "../../registry";
import { BasicNetworkService } from "./BasicNetworkService";

const serviceName = "Network";

export const networkManifest = defineService({
  name: serviceName,
  description: "Network service",
  dependencies: ["Logger", "Storage"],
  factory: (deps) => {
    const { Logger, Storage } = deps;
    console.log(`[${serviceName}] using ${Logger.name} and ${Storage.name}`);
    return new BasicNetworkService(serviceName);
  },
});

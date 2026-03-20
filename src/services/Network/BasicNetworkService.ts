import { AbstractService } from "../AbstractService";
import type { NetworkService } from "./NetworkService";

export class BasicNetworkService
  extends AbstractService
  implements NetworkService
{
  public constructor(name: string) {
    super(name);
  }

  public request(url: string): Promise<void> {
    console.log(`[${this.name}] request to ${url}`);
    return Promise.resolve();
  }
}

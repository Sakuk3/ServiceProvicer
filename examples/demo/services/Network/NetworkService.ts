import type { Service } from "../../../../src";

export interface NetworkService extends Service {
  request: (url: string) => Promise<void>;
}

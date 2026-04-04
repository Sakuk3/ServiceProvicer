import type { Service } from "./Service";

export abstract class AbstractService implements Service {
  protected constructor(public readonly name: string) {}
}

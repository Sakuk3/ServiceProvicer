import { Service } from "./Service";

export abstract class AbstractService implements Service {
  protected constructor(public readonly name: string) {}

  async onLogin() {
    /* empty */
  }

  async onLogout() {
    /* empty */
  }
}

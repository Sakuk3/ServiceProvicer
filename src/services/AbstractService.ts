import { Service } from "./Service";

export abstract class AbstractService implements Service {
  public constructor(public readonly name: string) {}

  onLogin() {
    console.log(`${this.name} logged in`);
  }

  onLogout() {
    console.log(`${this.name} logged out`);
  }
}

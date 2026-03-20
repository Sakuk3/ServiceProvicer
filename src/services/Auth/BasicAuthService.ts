import { AbstractService } from "../AbstractService";
import type { AuthService } from "./AuthService";

export class BasicAuthService extends AbstractService implements AuthService {
  public constructor(name: string) {
    super(name);
  }

  public authenticate(token: string): boolean {
    return token.length > 0;
  }
}

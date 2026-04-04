import type { Service } from "../../../../src";

export interface AuthService extends Service {
  authenticate: (token: string) => boolean;
}

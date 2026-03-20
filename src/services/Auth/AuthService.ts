import type { Service } from "../Service";

export interface AuthService extends Service {
  authenticate: (token: string) => boolean;
}

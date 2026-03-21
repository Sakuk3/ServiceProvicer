export interface Service {
  readonly name: string;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
}

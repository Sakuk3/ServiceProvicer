export interface Service {
  readonly name: string;
  onLogin: () => void;
  onLogout: () => void;
}

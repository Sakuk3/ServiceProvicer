export interface LoginEventPayload {
  username: string;
}

export interface RegistryEvents {
  login: LoginEventPayload;
  logout: undefined;
}

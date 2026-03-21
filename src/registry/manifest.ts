import type { ServiceKey, Services } from "./serviceTypes";

export type DependencyRecord<D extends readonly ServiceKey[]> = {
  [P in D[number]]: Services[P];
};

type FactoryFunction<
  K extends keyof Services,
  D extends readonly (keyof Services)[],
> = (dependencies: DependencyRecord<D>) => Services[K];

type ValidDependencies<
  K extends keyof Services,
  D extends readonly (keyof Services)[],
> = K extends D[number] ? never : D;

export type RegistryEventName = "login" | "logout";

type AsyncHookMethodKeys<T> = {
  [P in keyof T]-?: T[P] extends () => Promise<void> ? P : never;
}[keyof T] &
  string;

export type ServiceHooks<K extends keyof Services> = Partial<
  Record<RegistryEventName, AsyncHookMethodKeys<Services[K]>>
>;

export interface ServiceManifest<
  K extends keyof Services,
  D extends readonly (keyof Services)[],
> {
  name: K;
  description: string;
  dependencies: ValidDependencies<K, D>;
  hooks?: ServiceHooks<K>;
  factory: FactoryFunction<K, D>;
}

export const defineService = <
  K extends keyof Services,
  D extends readonly (keyof Services)[],
>(
  manifest: ServiceManifest<K, D>,
) => {
  return manifest;
};

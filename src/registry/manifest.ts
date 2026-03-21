import type { Services } from "./serviceTypes";
import type { DependencyRecord, RegistryEventName } from "./types";

/**
 * Creates a service instance once all declared dependencies are ready.
 */
type FactoryFunction<
  ServiceName extends keyof Services,
  DependencyNames extends readonly (keyof Services)[],
> = (dependencies: DependencyRecord<DependencyNames>) => Services[ServiceName];

/**
 * Prevents a service manifest from declaring itself as a dependency.
 *
 * If `ServiceName` appears in `DependencyNames`, the dependency list resolves
 * to `never` and the manifest fails to type-check.
 */
type ValidDependencies<
  ServiceName extends keyof Services,
  DependencyNames extends readonly (keyof Services)[],
> = ServiceName extends DependencyNames[number] ? never : DependencyNames;

type AsyncHookMethodKeys<T> = {
  [P in keyof T]-?: T[P] extends () => Promise<void> ? P : never;
}[keyof T] &
  string;

/**
 * Lifecycle hook map for a service.
 *
 * This is a record where:
 * - keys are registry event names such as `"login"` or `"logout"`
 * - values are method names on `Services[ServiceName]` that return `Promise<void>`
 *
 * Example: `{ login: "onLogin", logout: "onLogout" }`
 */
export type ServiceHooks<ServiceName extends keyof Services> = Partial<
  Record<RegistryEventName, AsyncHookMethodKeys<Services[ServiceName]>>
>;

/**
 * Describes how a service is registered and constructed.
 *
 * @typeParam ServiceName - Service name in the global `Services` map.
 * @typeParam DependencyNames - Ordered dependency names required by the service.
 */
export interface ServiceManifest<
  ServiceName extends keyof Services,
  DependencyNames extends readonly (keyof Services)[],
> {
  name: ServiceName;
  description: string;
  /**
   * Ordered dependency names required before this service can be constructed.
   *
   * A service cannot depend on itself. This constraint is enforced by
   * `ValidDependencies` at compile time.
   */
  dependencies: ValidDependencies<ServiceName, DependencyNames>;
  /**
   * Optional lifecycle hooks, keyed by event name and pointing to service
   * method names.
   */
  hooks?: ServiceHooks<ServiceName>;
  factory: FactoryFunction<ServiceName, DependencyNames>;
}

/**
 * Creates a strongly typed service manifest.
 *
 * @example
 * ```ts
 * const authManifest = defineService({
 *   name: "Auth",
 *   description: "Authentication service",
 *   dependencies: [] as const,
 *   hooks: {
 *     login: "login",
 *     logout: "logout",
 *   },
 *   factory: () => new BasicAuthService(),
 * });
 * ```
 *
 * @example
 * ```ts
 * const notificationManifest = defineService({
 *   name: "Notification",
 *   description: "Sends notifications over network",
 *   dependencies: ["Logger", "Network"] as const,
 *   hooks: {
 *     login: "onLogin",
 *   },
 *   factory: ({ Logger, Network }) =>
 *     new BasicNotificationService({ logger: Logger, network: Network }),
 * });
 * ```
 */
export const defineService = <
  ServiceName extends keyof Services,
  DependencyNames extends readonly (keyof Services)[],
>(
  manifest: ServiceManifest<ServiceName, DependencyNames>,
) => {
  const duplicateDependencies = getDuplicateDependencies(manifest.dependencies);

  if (duplicateDependencies.length > 0) {
    throw new Error(
      `Service '${manifest.name}' has duplicate dependencies: ${duplicateDependencies.join(", ")}`,
    );
  }

  return manifest;
};

const getDuplicateDependencies = (
  dependencies: readonly (keyof Services)[],
): (keyof Services)[] => {
  const seenDependencies = new Set<keyof Services>();
  const duplicateDependencies: (keyof Services)[] = [];

  for (const dependencyName of dependencies) {
    if (seenDependencies.has(dependencyName)) {
      if (!duplicateDependencies.includes(dependencyName)) {
        duplicateDependencies.push(dependencyName);
      }
      continue;
    }

    seenDependencies.add(dependencyName);
  }

  return duplicateDependencies;
};

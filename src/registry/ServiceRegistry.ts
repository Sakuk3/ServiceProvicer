import { ServiceKey, Services } from "./serviceTypes";
import { DependencyRecord, ServiceManifest } from "./manifest";

interface WaitingEntry {
  state: "waiting";
  dependencies: readonly ServiceKey[];
  createInstance: () => Services[ServiceKey];
}

interface ReadyEntry {
  state: "ready";
  instance: Services[ServiceKey];
}

type ServiceEntry = WaitingEntry | ReadyEntry;
export class ServiceRegistry {
  private readonly serviceStore = new Map<ServiceKey, ServiceEntry>();

  public registerService<
    K extends ServiceKey,
    D extends readonly ServiceKey[],
  >(manifest: ServiceManifest<K, D>): void {
    this.serviceStore.set(manifest.name, {
      state: "waiting",
      dependencies: manifest.dependencies,
      createInstance: () =>
        manifest.factory(this.buildDependencies(manifest.dependencies)) as Services[ServiceKey],
    });

    this.tryResolveAll();
  }

  public getService<K extends ServiceKey>(name: K): Services[K] {
    const entry = this.serviceStore.get(name);

    if (entry?.state !== "ready") {
      throw new Error(`Service ${name} not ready`);
    }

    return entry.instance as Services[K];
  }

  public getServiceUnsafe<K extends ServiceKey>(name: K): Services[K] | undefined {
    const entry = this.serviceStore.get(name);
    return entry?.state === "ready" ? (entry.instance as Services[K]) : undefined;
  }

  private tryResolveAll(): void {
    let progress = true;

    while (progress) {
      progress = false;

      this.serviceStore.forEach((entry, name) => {
        if (entry.state !== "waiting") return;

        const depsReady = entry.dependencies.every(
          (dep) => this.serviceStore.get(dep)?.state === "ready",
        );

        if (!depsReady) return;

        const instance = entry.createInstance();

        this.serviceStore.set(name, {
          state: "ready",
          instance,
        });

        progress = true;
      });
    }
  }

  private buildDependencies<D extends readonly ServiceKey[]>(
    deps: D,
  ): DependencyRecord<D> {
    const result = {} as DependencyRecord<D>;

    for (const dep of deps) {
      const entry = this.serviceStore.get(dep);

      if (entry?.state !== "ready") {
        throw new Error(`Dependency ${dep} not ready`);
      }

      (result as Record<ServiceKey, Services[ServiceKey]>)[dep] = entry.instance;
    }

    return result;
  }
}

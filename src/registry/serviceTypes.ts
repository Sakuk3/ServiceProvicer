export interface Services {
  readonly __servicesExtensionPoint__?: never;
}

type AugmentedServiceKey = Exclude<
  keyof Services,
  "__servicesExtensionPoint__"
>;

export type ServiceKey = AugmentedServiceKey;

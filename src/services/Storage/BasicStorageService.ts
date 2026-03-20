import { AbstractService } from "../AbstractService";
import type { StorageService } from "./StorageService";

export class BasicStorageService
  extends AbstractService
  implements StorageService
{
  public constructor(name: string) {
    super(name);
  }

  private readonly records = new Map<string, string>();

  public save(key: string, value: string): void {
    this.records.set(key, value);
  }
}

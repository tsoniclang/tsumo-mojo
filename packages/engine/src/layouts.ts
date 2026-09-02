import type { ModuleMount } from "./models.js";
import { TemplateEnvironment } from "./template/environment.js";
import type { DictValue } from "./template/values.js";

export type LayoutEnvironment = TemplateEnvironment;

export const createLayoutEnvironment = (
  siteDir: string,
  themeDir: string | undefined,
  mounts?: ModuleMount[],
  buildTime?: Date,
  siteData?: DictValue,
): TemplateEnvironment => {
  const environment = new TemplateEnvironment(buildTime, siteData);
  environment.configureLayout(siteDir, themeDir, mounts);
  return environment;
};

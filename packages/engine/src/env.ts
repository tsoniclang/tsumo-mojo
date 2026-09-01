import type { ModuleMount } from "./models.js";
import { ResourceManager } from "./resources.js";
import { createLayoutEnvironment } from "./layouts.js";
import { loadSiteData } from "./template/data-loader.js";
import type { TemplateEnvironment } from "./template/environment.js";

export type BuildEnvironment = TemplateEnvironment;

export const createBuildEnvironment = (
  siteDir: string,
  themeDir: string | undefined,
  outputDir: string,
  mounts?: ModuleMount[],
  buildTime?: Date,
): TemplateEnvironment => {
  const environment = createLayoutEnvironment(
    siteDir,
    themeDir,
    mounts,
    buildTime,
    loadSiteData(siteDir, themeDir, mounts),
  );
  environment.buildSiteDir = siteDir;
  environment.resourceManager = new ResourceManager(siteDir, themeDir, outputDir);
  environment.useProcessEnvironment = true;
  return environment;
};

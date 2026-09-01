import type { int32 } from "@tsonic/core/types.js";
import { env as processEnvironment } from "node:process";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createTsumoError } from "../diagnostics.js";
import { dirExists, fileExists, readTextFile } from "../fs.js";
import { I18nStore } from "../i18n.js";
import type { ModuleMount, PageContext, SiteContext } from "../models.js";
import type { ResourceManager } from "../resources.js";
import { resolveContainedResourcePath } from "../resources/paths.js";
import { TextBuilder } from "../utils/text-builder.js";
import { pathContainsOrEquals } from "../utils/paths.js";
import { replaceText, trimStartChar } from "../utils/strings.js";
import { getEmbeddedTemplateSource } from "./embedded-templates.js";
import type { TemplateNode } from "./nodes.js";
import { normalizeTemplateRelativePath, partialTemplateCandidates } from "./paths.js";
import { parseTemplate } from "./parser/parse-template.js";
import { RenderScope } from "./scope.js";
import type { RenderState } from "./scope.js";
import { Template } from "./template.js";
import {
  DeferredTemplateValue,
  DictValue,
  PageValue,
  ScratchStore,
} from "./values.js";
import type { TemplateValue } from "./values.js";

class DeferredTemplateRequest {
  key: string | undefined;
  body: TemplateNode[];
  definitions: Map<string, TemplateNode[]>;
  sourcePath: string | undefined;
  sourceText: string;
  sourceSegmentIndex: int32;
  data: TemplateValue;
  site: SiteContext;
  overrides: Map<string, TemplateNode[]>;
  state: RenderState;
  result: string | undefined;

  constructor(
    value: DeferredTemplateValue,
    body: TemplateNode[],
    definitions: Map<string, TemplateNode[]>,
    sourcePath: string | undefined,
    sourceText: string,
    sourceSegmentIndex: int32,
    site: SiteContext,
    overrides: Map<string, TemplateNode[]>,
    state: RenderState,
  ) {
    this.key = value.key;
    this.body = body;
    this.definitions = definitions;
    this.sourcePath = sourcePath;
    this.sourceText = sourceText;
    this.sourceSegmentIndex = sourceSegmentIndex;
    this.data = value.data;
    this.site = site;
    this.overrides = overrides;
    this.state = state;
    this.result = undefined;
  }
}

class DeferredTemplatePlacement {
  token: string;
  request: DeferredTemplateRequest;

  constructor(token: string, request: DeferredTemplateRequest) {
    this.token = token;
    this.request = request;
  }
}

export class PartialTemplateResolution {
  kind: "definition" | "template";
  definition: TemplateNode[] | undefined;
  template: Template | undefined;
  sourcePath: string | undefined;

  constructor(
    kind: "definition" | "template",
    definition: TemplateNode[] | undefined,
    template: Template | undefined,
    sourcePath: string | undefined,
  ) {
    this.kind = kind;
    this.definition = definition;
    this.template = template;
    this.sourcePath = sourcePath;
  }
}

export class TemplateEnvironment {
  isProduction: boolean;
  buildTime: Date;
  deferredRequests: DeferredTemplateRequest[];
  deferredPlacements: DeferredTemplatePlacement[];
  deferredPhase: "collecting" | "finalizing" | "finalized";
  siteData: DictValue;
  globalStore: ScratchStore;
  layoutConfigured: boolean;
  siteLayoutsDir: string;
  themeLayoutsDir: string | undefined;
  mountedLayoutDirs: string[];
  parsedTemplateBySource: Map<string, Template>;
  templateByLogicalPath: Map<string, Template>;
  templates: Map<string, Template>;
  missingLogicalTemplatePaths: Set<string>;
  shortcodeTemplateByName: Map<string, Template>;
  missingShortcodeNames: Set<string>;
  renderHookTemplateByName: Map<string, Template>;
  missingRenderHookNames: Set<string>;
  i18nStore: I18nStore;
  resourceManager: ResourceManager | undefined;
  buildSiteDir: string | undefined;
  useProcessEnvironment: boolean;
  environmentVariables: Map<string, string>;
  sourceFiles: Set<string>;
  identityTemplateSourcePaths: boolean;
  testSummaryPageViews: boolean;

  constructor(buildTime?: Date, siteData?: DictValue) {
    this.isProduction = true;
    this.buildTime = buildTime ?? new Date();
    this.deferredRequests = [];
    this.deferredPlacements = [];
    this.deferredPhase = "collecting";
    this.siteData = siteData ?? new DictValue(new Map<string, TemplateValue>());
    this.globalStore = new ScratchStore();
    this.layoutConfigured = false;
    this.siteLayoutsDir = "";
    this.themeLayoutsDir = undefined;
    this.mountedLayoutDirs = [];
    this.parsedTemplateBySource = new Map<string, Template>();
    this.templateByLogicalPath = new Map<string, Template>();
    this.templates = this.templateByLogicalPath;
    this.missingLogicalTemplatePaths = new Set<string>();
    this.shortcodeTemplateByName = new Map<string, Template>();
    this.missingShortcodeNames = new Set<string>();
    this.renderHookTemplateByName = new Map<string, Template>();
    this.missingRenderHookNames = new Set<string>();
    this.i18nStore = new I18nStore();
    this.resourceManager = undefined;
    this.buildSiteDir = undefined;
    this.useProcessEnvironment = false;
    this.environmentVariables = new Map<string, string>();
    this.sourceFiles = new Set<string>();
    this.identityTemplateSourcePaths = false;
    this.testSummaryPageViews = false;
  }

  configureLayout(siteDir: string, themeDirRaw: string | undefined, mountsRaw?: ModuleMount[]): void {
    const themeDir = themeDirRaw;
    const mounts = mountsRaw;
    this.layoutConfigured = true;
    this.siteLayoutsDir = join(siteDir, "layouts");
    this.themeLayoutsDir = themeDir !== undefined ? join(themeDir, "layouts") : undefined;
    if (themeDir !== undefined) this.i18nStore.loadFromDir(join(themeDir, "i18n"));
    if (mounts !== undefined) {
      for (let index = mounts.length - 1; index >= 0; index--) {
        const mount = mounts[index]!;
        if (mount.target !== "i18n") continue;
        const mountPath = isAbsolute(mount.source) ? mount.source : join(siteDir, mount.source);
        if (dirExists(mountPath)) this.i18nStore.loadFromDir(mountPath);
      }
    }
    this.i18nStore.loadFromDir(join(siteDir, "i18n"));
    if (mounts !== undefined) {
      for (let index = 0; index < mounts.length; index++) {
        const mount = mounts[index]!;
        if (mount.target !== "layouts") continue;
        const mountPath = isAbsolute(mount.source) ? mount.source : join(siteDir, mount.source);
        if (dirExists(mountPath)) this.mountedLayoutDirs.push(mountPath);
      }
    }
  }

  getEnvironmentVariable(name: string): string | undefined {
    return this.useProcessEnvironment ? processEnvironment[name] : this.environmentVariables.get(name);
  }

  sourceFileExists(path: string): boolean {
    const siteDir = this.buildSiteDir;
    if (siteDir !== undefined) {
      return fileExists(resolveContainedResourcePath(siteDir, path));
    }
    return this.sourceFiles.has(path);
  }

  registerDeferredTemplate(
    value: DeferredTemplateValue,
    body: TemplateNode[],
    definitions: Map<string, TemplateNode[]>,
    sourcePath: string | undefined,
    sourceText: string,
    sourceSegmentIndex: int32,
    site: SiteContext,
    overrides: Map<string, TemplateNode[]>,
    state: RenderState,
  ): string {
    if (this.deferredPhase !== "collecting") {
      throw createTsumoError(
        "TSUMO_TEMPLATE_DEFER_LIFECYCLE_INVALID",
        "templates.Defer cannot register work after deferred-template finalization begins",
      );
    }

    let request: DeferredTemplateRequest | undefined = undefined;
    if (value.key !== undefined) {
      for (let index = 0; index < this.deferredRequests.length; index++) {
        const candidate = this.deferredRequests[index]!;
        if (
          candidate.key === value.key &&
          candidate.sourcePath === sourcePath &&
          candidate.sourceText === sourceText &&
          candidate.sourceSegmentIndex === sourceSegmentIndex
        ) {
          request = candidate;
          break;
        }
      }
    }
    if (request === undefined) {
      request = new DeferredTemplateRequest(
        value,
        body,
        definitions,
        sourcePath,
        sourceText,
        sourceSegmentIndex,
        site,
        overrides,
        state,
      );
      this.deferredRequests.push(request);
    }

    const ordinal: int32 = this.deferredPlacements.length;
    const token = `\u0000TSUMO-DEFERRED-TEMPLATE:${ordinal}\u0000`;
    this.deferredPlacements.push(new DeferredTemplatePlacement(token, request));
    return token;
  }

  finalizeDeferredTemplates(): Map<string, string> {
    if (this.deferredPhase === "finalizing") {
      throw createTsumoError("TSUMO_TEMPLATE_DEFER_LIFECYCLE_INVALID", "Deferred-template finalization is already running");
    }
    if (this.deferredPhase === "collecting") {
      this.deferredPhase = "finalizing";
      for (let index = 0; index < this.deferredRequests.length; index++) {
        const request = this.deferredRequests[index]!;
        request.result = this.renderTemplateDefinition(
          request.body,
          request.definitions,
          request.sourcePath,
          request.data,
          request.site,
          request.overrides,
          request.state,
        );
      }
      this.deferredPhase = "finalized";
    }

    const results = new Map<string, string>();
    for (let index = 0; index < this.deferredPlacements.length; index++) {
      const placement = this.deferredPlacements[index]!;
      const result = placement.request.result;
      if (result === undefined) {
        throw createTsumoError("TSUMO_TEMPLATE_DEFER_LIFECYCLE_INVALID", "A deferred template has no finalized output");
      }
      results.set(placement.token, result);
    }
    return results;
  }

  setSiteData(value: DictValue): void {
    this.siteData = value;
  }

  getSiteData(): DictValue {
    return this.siteData;
  }

  getGlobalStore(): ScratchStore {
    return this.globalStore;
  }


  resolvePartialTemplate(
    name: string,
    callerSourcePath: string | undefined,
    definitions: Map<string, TemplateNode[]>,
  ): PartialTemplateResolution | undefined {
    let callerRelativePath: string | undefined = undefined;
    if (callerSourcePath !== undefined) {
      const selectedSourcePath = callerSourcePath as string;
      callerRelativePath = this.getTemplateSourceRelativePath(selectedSourcePath);
    }
    const candidates = partialTemplateCandidates(name, callerRelativePath);
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index]!;
      const definition = definitions.get(candidate);
      if (definition !== undefined) {
        return new PartialTemplateResolution("definition", definition, undefined, callerSourcePath);
      }
      const template = this.getTemplate(candidate);
      if (template !== undefined) {
        const selected = template.withInheritedDefinitions(definitions);
        return new PartialTemplateResolution("template", undefined, selected, selected.sourcePath);
      }
    }
    return undefined;
  }

  getResourceManager(): ResourceManager | undefined {
    return this.resourceManager;
  }

  renderTextTemplateSource(
    source: string,
    context: TemplateValue,
    site: SiteContext,
    overrides: Map<string, TemplateNode[]>,
    state?: RenderState,
  ): string {
    return this.renderTextTemplate(parseTemplate(source), context, site, overrides, state);
  }

  renderTemplate(
    template: Template,
    context: TemplateValue,
    site: SiteContext,
    overrides: Map<string, TemplateNode[]>,
    state?: RenderState,
  ): string {
    const output = new TextBuilder();
    const scope = new RenderScope(context, context, site, this, undefined, state, template.sourcePath);
    template.renderInto(output, scope, this, overrides);
    return output.toString();
  }

  renderTextTemplate(
    template: Template,
    context: TemplateValue,
    site: SiteContext,
    overrides: Map<string, TemplateNode[]>,
    state?: RenderState,
  ): string {
    const output = new TextBuilder();
    const scope = new RenderScope(context, context, site, this, undefined, state, template.sourcePath);
    template.renderTextInto(output, scope, this, overrides);
    return output.toString();
  }

  renderTemplateDefinition(
    nodes: TemplateNode[],
    definitions: Map<string, TemplateNode[]>,
    sourcePath: string | undefined,
    context: TemplateValue,
    site: SiteContext,
    overrides: Map<string, TemplateNode[]>,
    state?: RenderState,
  ): string {
    return this.renderTemplate(new Template(nodes, definitions, sourcePath), context, site, overrides, state);
  }

  getTemplate(relPathRaw: string): Template | undefined {
    const slash = "/";
    const relPath = normalizeTemplateRelativePath(trimStartChar(relPathRaw, slash).trim());
    const logicalCached = this.templateByLogicalPath.get(relPath);
    if (logicalCached !== undefined) return logicalCached;
    if (this.missingLogicalTemplatePaths.has(relPath)) return undefined;
    if (!this.layoutConfigured) return undefined;
    const relativePaths: string[] = [];
    if (extname(relPath) !== "") relativePaths.push(relPath);
    else {
      relativePaths.push(relPath + ".html");
      relativePaths.push(relPath + ".htm");
    }

    const candidates: string[] = [];
    for (let i = 0; i < relativePaths.length; i++) {
      candidates.push(join(this.siteLayoutsDir, replaceText(relativePaths[i]!, slash, `${sep}`)));
    }
    const themeLayoutsDir = this.themeLayoutsDir;
    if (themeLayoutsDir !== undefined) {
      for (let i = 0; i < relativePaths.length; i++) {
        candidates.push(join(themeLayoutsDir, replaceText(relativePaths[i]!, slash, `${sep}`)));
      }
    }
    for (let i = 0; i < this.mountedLayoutDirs.length; i++) {
      for (let pathIndex = 0; pathIndex < relativePaths.length; pathIndex++) {
        candidates.push(join(this.mountedLayoutDirs[i]!, replaceText(relativePaths[pathIndex]!, slash, `${sep}`)));
      }
    }

    let resolved: string | undefined = undefined;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (fileExists(candidate)) {
        resolved = candidate;
        break;
      }
    }
    if (resolved === undefined) {
      let embeddedPath: string | undefined = undefined;
      let embeddedSource: string | undefined = undefined;
      for (let i = 0; i < relativePaths.length; i++) {
        const candidateSource = getEmbeddedTemplateSource(relativePaths[i]!);
        if (candidateSource === undefined) continue;
        embeddedPath = relativePaths[i]!;
        embeddedSource = candidateSource;
        break;
      }
      if (embeddedSource === undefined || embeddedPath === undefined) {
        this.missingLogicalTemplatePaths.add(relPath);
        return undefined;
      }
      const embeddedKey = `embedded:${embeddedPath.toLowerCase()}`;
      const embeddedCached = this.parsedTemplateBySource.get(embeddedKey);
      if (embeddedCached !== undefined) {
        this.templateByLogicalPath.set(relPath, embeddedCached);
        return embeddedCached;
      }
      const embedded = parseTemplate(embeddedSource, embeddedKey);
      this.parsedTemplateBySource.set(embeddedKey, embedded);
      this.templateByLogicalPath.set(relPath, embedded);
      return embedded;
    }

    const cached = this.parsedTemplateBySource.get(resolved);
    if (cached !== undefined) {
      this.templateByLogicalPath.set(relPath, cached);
      return cached;
    }

    const text = readTextFile(resolved);
    const tpl = parseTemplate(text, resolved);
    this.parsedTemplateBySource.set(resolved, tpl);
    this.templateByLogicalPath.set(relPath, tpl);
    return tpl;
  }

  getTemplateSourceRelativePath(sourcePath: string): string | undefined {
    if (this.identityTemplateSourcePaths) return sourcePath;
    if (!this.layoutConfigured) return undefined;
    const source = resolve(sourcePath);
    const roots: string[] = [this.siteLayoutsDir];
    const themeLayoutsDir = this.themeLayoutsDir;
    if (themeLayoutsDir !== undefined) roots.push(themeLayoutsDir);
    for (let index = 0; index < this.mountedLayoutDirs.length; index++) {
      roots.push(this.mountedLayoutDirs[index]!);
    }

    for (let index = 0; index < roots.length; index++) {
      const root = resolve(roots[index]!);
      if (!pathContainsOrEquals(root, source)) continue;
      return normalizeTemplateRelativePath(replaceText(relative(root, source), "\\", "/"));
    }
    return undefined;
  }

  renderPageView(page: PageContext, viewRaw: string, state: RenderState | undefined): string | undefined {
    if (this.testSummaryPageViews && viewRaw === "summary") return `<summary>${page.title}</summary>`;
    if (!this.layoutConfigured) return undefined;
    const view = normalizeTemplateRelativePath(viewRaw);
    if (view === "") return undefined;
    const candidates: string[] = [];
    if (page.type.trim() !== "") candidates.push(`${page.type}/${view}`);
    if (page.section.trim() !== "" && page.section !== page.type) candidates.push(`${page.section}/${view}`);
    candidates.push(`_default/${view}`);
    candidates.push(view);
    const templatePath = selectTemplatePath(this, candidates);
    if (templatePath === undefined) return undefined;
    const template = this.getTemplate(templatePath);
    if (template === undefined) return undefined;
    const context = new PageValue(page);
    return this.renderTemplate(template, context, page.site, new Map<string, TemplateNode[]>(), state);
  }

  getShortcodeTemplate(name: string): Template | undefined {
    const cached = this.shortcodeTemplateByName.get(name);
    if (cached !== undefined) return cached;
    if (this.missingShortcodeNames.has(name)) return undefined;
    if (!this.layoutConfigured) return undefined;

    const candidates: string[] = [
      join(this.siteLayoutsDir, "shortcodes", name + ".html"),
      join(this.siteLayoutsDir, "_shortcodes", name + ".html"),
    ];
    const themeLayoutsDir = this.themeLayoutsDir;
    if (themeLayoutsDir !== undefined) {
      candidates.push(join(themeLayoutsDir, "shortcodes", name + ".html"));
      candidates.push(join(themeLayoutsDir, "_shortcodes", name + ".html"));
    }
    for (let i = 0; i < this.mountedLayoutDirs.length; i++) {
      const dir = this.mountedLayoutDirs[i]!;
      candidates.push(join(dir, "shortcodes", name + ".html"));
      candidates.push(join(dir, "_shortcodes", name + ".html"));
    }

    let resolved: string | undefined = undefined;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (fileExists(candidate)) {
        resolved = candidate;
        break;
      }
    }
    if (resolved === undefined) {
      this.missingShortcodeNames.add(name);
      return undefined;
    }

    const tpl = parseTemplate(readTextFile(resolved), resolved);
    this.shortcodeTemplateByName.set(name, tpl);
    return tpl;
  }

  getRenderHookTemplate(hookName: string): Template | undefined {
    const cached = this.renderHookTemplateByName.get(hookName);
    if (cached !== undefined) return cached;
    if (this.missingRenderHookNames.has(hookName)) return undefined;
    if (!this.layoutConfigured) return undefined;

    const candidates: string[] = [
      join(this.siteLayoutsDir, "_markup", hookName + ".html"),
      join(this.siteLayoutsDir, "_default", "_markup", hookName + ".html"),
    ];
    const themeLayoutsDir = this.themeLayoutsDir;
    if (themeLayoutsDir !== undefined) {
      candidates.push(join(themeLayoutsDir, "_markup", hookName + ".html"));
      candidates.push(join(themeLayoutsDir, "_default", "_markup", hookName + ".html"));
    }
    for (let i = 0; i < this.mountedLayoutDirs.length; i++) {
      const dir = this.mountedLayoutDirs[i]!;
      candidates.push(join(dir, "_markup", hookName + ".html"));
      candidates.push(join(dir, "_default", "_markup", hookName + ".html"));
    }

    let resolved: string | undefined = undefined;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (fileExists(candidate)) {
        resolved = candidate;
        break;
      }
    }
    if (resolved === undefined) {
      this.missingRenderHookNames.add(hookName);
      return undefined;
    }

    const tpl = parseTemplate(readTextFile(resolved), resolved);
    this.renderHookTemplateByName.set(hookName, tpl);
    return tpl;
  }

  getI18n(lang: string, key: string, count?: int32): string {
    return this.i18nStore.translate(lang, key, count);
  }
}

const selectTemplatePath = (
  environment: TemplateEnvironment,
  candidates: string[],
): string | undefined => {
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]!;
    if (environment.getTemplate(candidate) !== undefined) return candidate;
  }
  return undefined;
};

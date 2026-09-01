import {
  DictValue, HtmlString, I18nStore, PageContext, parseTemplate, RenderScope, RenderState, ResourceManager,
  SiteConfig, SiteContext, Template, TemplateEnvironment, TemplateNode, TemplateValue, TextBuilder,
  TsumoDiagnostic, TsumoError,
} from "@tsumo/engine/testing.js";
import type { int32 } from "@tsonic/core/types.js";

export const createTestTemplateEnvironment = (
  resourceManager?: ResourceManager,
): TemplateEnvironment => {
  const environment = new TemplateEnvironment(new Date(1704067200000));
  environment.resourceManager = resourceManager;
  environment.environmentVariables.set("TSUMO_TEST_VALUE", "configured");
  environment.sourceFiles.add("static/existing.css");
  environment.identityTemplateSourcePaths = true;
  environment.testSummaryPageViews = true;
  return environment;
};

export const createSite = (): SiteContext => {
  const config = new SiteConfig("Test Site", "https://example.test/", "en", undefined, undefined);
  return new SiteContext(config, [], undefined, undefined);
};

export const renderWithRoot = (source: string, root: TemplateValue): string => {
  const template = parseTemplate(source);
  const environment = createTestTemplateEnvironment();
  const site = createSite();
  const scope = new RenderScope(root, root, site, environment, undefined);
  const output = new TextBuilder();
  template.renderInto(output, scope, environment, new Map());
  return output.toString();
};

export const render = (source: string): string =>
  renderWithRoot(source, new DictValue(new Map<string, TemplateValue>()));

export const createPage = (site: SiteContext, title: string, date: string, kind: string): PageContext => {
  const emptyPages: PageContext[] = [];
  const emptyStrings: string[] = [];
  const emptyHtml = new HtmlString("");
  return new PageContext(
    title, date, date, false, kind, kind === "page" ? "posts" : "", kind,
    title.toLowerCase(), `/${title.toLowerCase()}/`, "", emptyHtml,
    new HtmlString(`<p>${title}</p>`), new HtmlString(`<p>${title}</p>`), "",
    emptyStrings, emptyStrings, new Map(), undefined, site.Language, emptyPages,
    undefined, site, emptyPages, undefined, emptyPages, undefined,
  );
};

export const captureDiagnosticCode = (operation: () => void): string => {
  try {
    operation();
  } catch (error) {
    if (error instanceof TsumoError) return error.diagnostic.code;
    throw error;
  }
  throw new Error("Expected a TsumoError diagnostic");
};

export const captureDiagnostic = (operation: () => void): TsumoDiagnostic => {
  try {
    operation();
  } catch (error) {
    if (error instanceof TsumoError) return error.diagnostic;
    throw error;
  }
  throw new Error("Expected a TsumoError diagnostic");
};

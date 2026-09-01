import type {
  HeadingHookValue,
  ImageHookValue,
  LinkHookValue,
  ShortcodeValue,
} from "../contexts.js";
import type { PageResourceCollectionValue } from "../evaluation/page-resource-semantics.js";
import type { AnyArrayValue, StringArrayValue } from "./arrays.js";
import type { DateValue } from "./date.js";
import type { DeferredTemplateValue } from "./deferred.js";
import type { DictValue } from "./dict.js";
import type {
  DocsMountArrayValue,
  DocsMountValue,
  NavArrayValue,
  NavItemValue,
} from "./docs.js";
import type { MediaTypeValue } from "./media.js";
import type { MenuArrayValue, MenuEntryValue, MenusValue } from "./menus.js";
import type {
  OutputFormatValue,
  OutputFormatsGetValue,
  OutputFormatsValue,
} from "./output.js";
import type {
  FileValue,
  PageArrayValue,
  PageDataValue,
  PageGroupValue,
  PageResourcesValue,
  PageValue,
} from "./page.js";
import type { PaginatorValue } from "./pagination.js";
import type { BoolValue, HtmlValue, NumberValue, StringValue } from "./primitives.js";
import type {
  ResourceDataValue,
  ResourceNamespaceValue,
  ResourceValue,
} from "./resources.js";
import type { ScratchValue } from "./scratch.js";
import type {
  LanguageValue,
  SiteValue,
  SitesArrayValue,
  SitesValue,
} from "./site.js";
import type { TaxonomiesValue, TaxonomyTermsValue } from "./taxonomies.js";
import type { UrlQueryValue, UrlValue } from "./url.js";
import type { VersionStringValue } from "./version.js";

export class NilValue {}

export type TemplateValue =
  | NilValue
  | StringValue
  | BoolValue
  | NumberValue
  | HtmlValue
  | DateValue
  | PageValue
  | FileValue
  | PageArrayValue
  | PageGroupValue
  | PageDataValue
  | PageResourcesValue
  | SiteValue
  | LanguageValue
  | SitesValue
  | SitesArrayValue
  | ResourceDataValue
  | ResourceNamespaceValue
  | ResourceValue
  | StringArrayValue
  | AnyArrayValue
  | DocsMountValue
  | DocsMountArrayValue
  | NavItemValue
  | NavArrayValue
  | MenuEntryValue
  | MenuArrayValue
  | MenusValue
  | OutputFormatsValue
  | OutputFormatValue
  | OutputFormatsGetValue
  | TaxonomiesValue
  | TaxonomyTermsValue
  | MediaTypeValue
  | DictValue
  | ScratchValue
  | UrlValue
  | UrlQueryValue
  | VersionStringValue
  | PaginatorValue
  | DeferredTemplateValue
  | ShortcodeValue
  | LinkHookValue
  | ImageHookValue
  | HeadingHookValue
  | PageResourceCollectionValue;

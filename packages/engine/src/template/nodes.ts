import type { int32 } from "@tsonic/core/types.js";
import type { Pipeline } from "./syntax/expressions.js";

export class BreakNode {}

export class ContinueNode {}

export class TextNode {
  text: string;

  constructor(text: string) {
    this.text = text;
  }
}

export class OutputNode {
  pipeline: Pipeline;
  escape: boolean;

  constructor(pipeline: Pipeline, escape: boolean) {
    this.pipeline = pipeline;
    this.escape = escape;
  }
}

export class AssignmentNode {
  name: string;
  pipeline: Pipeline;
  declare: boolean;

  constructor(name: string, pipeline: Pipeline, declare: boolean) {
    this.name = name;
    this.pipeline = pipeline;
    this.declare = declare;
  }
}

export class TemplateInvokeNode {
  name: string;
  context: Pipeline;

  constructor(name: string, context: Pipeline) {
    this.name = name;
    this.context = context;
  }
}

export class TemplateVariableBinding {
  name: string;
  declare: boolean;

  constructor(name: string, declare: boolean) {
    this.name = name;
    this.declare = declare;
  }
}

export class IfNode {
  condition: Pipeline;
  binding: TemplateVariableBinding | undefined;
  thenNodes: TemplateNode[];
  elseNodes: TemplateNode[];

  constructor(
    condition: Pipeline,
    binding: TemplateVariableBinding | undefined,
    thenNodes: TemplateNode[],
    elseNodes: TemplateNode[],
  ) {
    this.condition = condition;
    this.binding = binding;
    this.thenNodes = thenNodes;
    this.elseNodes = elseNodes;
  }
}

export class RangeNode {
  expr: Pipeline;
  keyVar: string | undefined;
  valueVar: string | undefined;
  body: TemplateNode[];
  elseBody: TemplateNode[];

  constructor(
    expr: Pipeline,
    keyVar: string | undefined,
    valueVar: string | undefined,
    body: TemplateNode[],
    elseBody: TemplateNode[],
  ) {
    this.expr = expr;
    this.keyVar = keyVar;
    this.valueVar = valueVar;
    this.body = body;
    this.elseBody = elseBody;
  }
}

export class WithNode {
  expr: Pipeline;
  binding: TemplateVariableBinding | undefined;
  body: TemplateNode[];
  elseBody: TemplateNode[];
  sourceText: string;
  sourceSegmentIndex: int32;

  constructor(
    expr: Pipeline,
    binding: TemplateVariableBinding | undefined,
    body: TemplateNode[],
    elseBody: TemplateNode[],
    sourceText: string,
    sourceSegmentIndex: int32,
  ) {
    this.expr = expr;
    this.binding = binding;
    this.body = body;
    this.elseBody = elseBody;
    this.sourceText = sourceText;
    this.sourceSegmentIndex = sourceSegmentIndex;
  }
}

export class BlockNode {
  name: string;
  context: Pipeline;
  fallback: TemplateNode[];

  constructor(name: string, context: Pipeline, fallback: TemplateNode[]) {
    this.name = name;
    this.context = context;
    this.fallback = fallback;
  }
}

export type TemplateNode =
  | BreakNode
  | ContinueNode
  | TextNode
  | OutputNode
  | AssignmentNode
  | TemplateInvokeNode
  | IfNode
  | RangeNode
  | WithNode
  | BlockNode;

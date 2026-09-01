export class TokenExpr {
  token: string;

  constructor(token: string) {
    this.token = token;
  }
}

export class PipelineExpr {
  pipeline: Pipeline;

  constructor(pipeline: Pipeline) {
    this.pipeline = pipeline;
  }
}

export class CommandExpr {
  command: Command;

  constructor(command: Command) {
    this.command = command;
  }
}

export class AccessExpr {
  base: Expr;
  segments: string[];

  constructor(base: Expr, segments: string[]) {
    this.base = base;
    this.segments = segments;
  }
}

export class Command {
  head: Expr;
  args: Expr[];

  constructor(head: Expr, args: Expr[]) {
    this.head = head;
    this.args = args;
  }
}

export class Pipeline {
  stages: Command[];

  constructor(stages: Command[]) {
    this.stages = stages;
  }
}

export type Expr = TokenExpr | PipelineExpr | CommandExpr | AccessExpr;

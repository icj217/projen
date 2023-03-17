import { resolve } from "path";
import { existsSync, outputFileSync } from "fs-extra";
import { Component } from "../component";
import { renderJavaScriptOptions } from "../javascript/render-options";
import { TypeScriptProject } from "../typescript";

export interface ProjenrcOptions {
  /**
   * The name of the projenrc file.
   * @default ".projenrc.ts"
   */
  readonly filename?: string;

  /**
   * A directory tree that may contain *.ts files that can be referenced from
   * your projenrc typescript file.
   *
   * @default "projenrc"
   */
  readonly projenCodeDir?: string;
}

/**
 * Sets up a typescript project to use TypeScript for projenrc.
 */
export class Projenrc extends Component {
  private readonly rcfile: string;
  private readonly _projenCodeDir: string;
  private readonly _tsProject: TypeScriptProject;

  constructor(project: TypeScriptProject, options: ProjenrcOptions = {}) {
    super(project);
    this._tsProject = project;

    this.rcfile = options.filename ?? ".projenrc.ts";
    this._projenCodeDir = options.projenCodeDir ?? "projenrc";

    // this is the task projen executes when running `projen` without a
    // specific task (if this task is not defined, projen falls back to
    // running "node .projenrc.js").
    project.addDevDeps("ts-node");

    // we use "tsconfig.dev.json" here to allow projen source files to reside
    // anywhere in the project tree.
    project.defaultTask?.exec(
      `ts-node --project ${project.tsconfigDev.fileName} ${this.rcfile}`
    );

    this.generateProjenrc();
  }

  public preSynthesize(): void {
    this._tsProject.tsconfigDev.addInclude(this.rcfile);
    this._tsProject.tsconfigDev.addInclude(`${this._projenCodeDir}/**/*.ts`);

    this._tsProject.eslint?.addLintPattern(this._projenCodeDir);
    this._tsProject.eslint?.addLintPattern(this.rcfile);
    this._tsProject.eslint?.allowDevDeps(this.rcfile);
    this._tsProject.eslint?.allowDevDeps(`${this._projenCodeDir}/**/*.ts`);
    this._tsProject.eslint?.addIgnorePattern(`!${this.rcfile}`);
    this._tsProject.eslint?.addIgnorePattern(`!${this._projenCodeDir}/**/*.ts`);

    this._tsProject.eslint?.addOverride({
      files: [this.rcfile],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "import/no-extraneous-dependencies": "off",
      },
    });
  }

  private generateProjenrc() {
    const rcfile = resolve(this.project.outdir, this.rcfile);
    if (existsSync(rcfile)) {
      return; // already exists
    }

    const bootstrap = this.project.initProject;
    if (!bootstrap) {
      return;
    }

    const parts = bootstrap.fqn.split(".");
    const moduleName = parts[0];
    const importName = parts[1];
    const className = parts.slice(1).join(".");

    const { renderedOptions, imports } = renderJavaScriptOptions({
      args: bootstrap.args,
      type: bootstrap.type,
      comments: bootstrap.comments,
    });

    imports.add(moduleName, importName);

    const lines = new Array<string>();
    lines.push(...imports.asEsmImports());
    lines.push();
    lines.push(`const project = new ${className}(${renderedOptions});`);
    lines.push();
    lines.push("project.synth();");

    outputFileSync(rcfile, lines.join("\n"));
    this.project.logger.info(
      `Project definition file was created at ${rcfile}`
    );
  }
}

import { Uri } from "vscode";
import { provideSingleton } from "../utils";

export interface RunModelParams {
  plusOperatorLeft: string;
  modelName: string;
  plusOperatorRight: string;
}

export interface CommandProcessExecutionParams {
  cwd?: string;
  args: string[];
}

export interface DBTCommand {
  commandAsString?: string;
  statusMessage: string;
  processExecutionParams: CommandProcessExecutionParams;
  focus?: boolean;
}

@provideSingleton(DBTCommandFactory)
export class DBTCommandFactory {
  createImportDBTCommand(): DBTCommand {
    return {
      statusMessage: "Detecting dbt installation...",
      processExecutionParams: {
        args: ["-c", 'import dbt.main; print("dbt is installed")'],
      },
    };
  }

  createVersionCommand(): DBTCommand {
    return {
      statusMessage: "Detecting dbt version...",
      processExecutionParams: {
        args: ["-c", this.dbtCommand("'--version'")],
      },
    };
  }

  createListCommand(projectRoot: Uri): DBTCommand {
    return {
      commandAsString: "dbt list",
      statusMessage: "Listing dbt models...",
      processExecutionParams: {
        cwd: projectRoot.fsPath,
        args: ["-c", this.dbtCommand("'list'")],
      },
    };
  }

  createRunModelCommand(projectRoot: Uri, params: RunModelParams) {
    const { plusOperatorLeft, modelName, plusOperatorRight } = params;
    return {
      commandAsString: `dbt run --model ${params.plusOperatorLeft}${params.modelName}${params.plusOperatorRight}`,
      statusMessage: "Running dbt models...",
      processExecutionParams: {
        cwd: projectRoot.fsPath,
        args: [
          "-c",
          this.dbtCommand([
            "'run'",
            "'--model'",
            `'${plusOperatorLeft}${modelName}${plusOperatorRight}'`,
          ]),
        ],
      },
      focus: true,
    };
  }

  createCompileModelCommand(projectRoot: Uri, params: RunModelParams) {
    const { plusOperatorLeft, modelName, plusOperatorRight } = params;
    return {
      commandAsString: `dbt compile --model ${params.plusOperatorLeft}${params.modelName}${params.plusOperatorRight}`,
      statusMessage: "compiling dbt models...",
      processExecutionParams: {
        cwd: projectRoot.fsPath,
        args: [
          "-c",
          this.dbtCommand([
            "'compile'",
            "'--model'",
            `'${plusOperatorLeft}${modelName}${plusOperatorRight}'`,
          ]),
        ],
      },
      focus: true,
    };
  }

  createInstallDBTCommand() {
    return {
      commandAsString: "pip install dbt",
      statusMessage: "Installing dbt...",
      processExecutionParams: { args: ["-m", "pip", "install", "dbt"] },
      focus: true,
    };
  }

  createUpdateDBTCommand() {
    return {
      commandAsString: "pip install --upgrade dbt",
      statusMessage: "Updating dbt...",
      processExecutionParams: {
        args: ["-m", "pip", "install", "dbt", "--upgrade"],
      },
      focus: true,
    };
  }

  createSqlCommand(projectRoot: Uri, sql: string): DBTCommand {
    return {
      commandAsString: "Executing SQL",
      statusMessage: "Executing SQL...",
      processExecutionParams: {
        cwd: projectRoot.fsPath,
        args: ["-c", this.customCommand(sql)],
      },
      focus: true,
    };
  }

  private dbtCommand(cmd: string | string[]): string {
    return `import dbt.main; dbt.main.main([${cmd}])`;
  }

  private customCommand(sql: string): string {
    return `
from dbt.task.runnable import ManifestTask
from dbt.main import parse_args, initialize_config_values, adapter_management
from dbt.adapters.factory import get_adapter

class RunQuery(ManifestTask):
    def run(self) -> None:
        adapter = get_adapter(self.config)
        with adapter.connection_named('master'):
            (_, output) = adapter.execute("""${sql}""", fetch=True)
            output.print_json()

if __name__ == "__main__":
    parsed = parse_args(['run'])
    initialize_config_values(parsed)

    with adapter_management():
        RunQuery.pre_init_hook(parsed)
        task = RunQuery.from_args(args=parsed)
        results = task.run()
    `;
  }
}

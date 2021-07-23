import {
  CancellationToken,
  Disposable,
  EventEmitter,
  Terminal,
  window,
  Uri,
  workspace,
} from "vscode";
import { DBTCommandQueue } from "./dbtCommandQueue";
import { DBTCommand, DBTCommandFactory } from "./dbtCommandFactory";
import {
  CommandProcessExecution,
  CommandProcessExecutionFactory,
} from "../commandProcessExecution";
import { DBTInstallationFoundEvent } from "./dbtVersionEvent";
import { PythonEnvironment } from "../manifest/pythonEnvironment";
import { provideSingleton } from "../utils";

@provideSingleton(DBTClient)
export class DBTClient implements Disposable {
  private _onDBTInstallationFound =
    new EventEmitter<DBTInstallationFoundEvent>();
  public readonly onDBTInstallationFound = this._onDBTInstallationFound.event;
  private static readonly INSTALLED_VERSION =
    /(?<=installed\sversion:\s)(\d+.\d+.\d+)(?=\D+)/g;
  private static readonly LATEST_VERSION =
    /(?<=latest\sversion:\s)(\d+.\d+.\d+)(?=\D+)/g;
  private static readonly IS_INSTALLED = /installed\sversion/g;
  private pythonPath?: string;
  private readonly writeEmitter = new EventEmitter<string>();
  private dbtInstalled?: boolean;
  private terminal?: Terminal;
  private disposables: Disposable[] = [
    this.writeEmitter,
    this._onDBTInstallationFound,
  ];

  constructor(
    private pythonEnvironment: PythonEnvironment,
    private dbtCommandFactory: DBTCommandFactory,
    private queue: DBTCommandQueue,
    private commandProcessExecutionFactory: CommandProcessExecutionFactory
  ) {}

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  async detectDBT(): Promise<void> {
    const pythonEnvironment = await this.pythonEnvironment.getEnvironment();
    this.disposables.push(
      pythonEnvironment.onDidChangeExecutionDetails(() =>
        this.handlePythonExtension()
      )
    );
    await this.handlePythonExtension();
  }

  async installDBT(): Promise<void> {
    if (this.pythonPath === undefined) {
      window.showErrorMessage(
        "Please ensure you have selected a Python interpreter before installing DBT."
      );
      return;
    }
    await this.executeCommandImmediately(
      this.dbtCommandFactory.createInstallDBTCommand()
    );
    await this.handlePythonExtension();
  }

  async updateDBT(): Promise<void> {
    if (this.pythonPath === undefined) {
      window.showErrorMessage(
        "Please ensure you have selected a Python interpreter before updating DBT."
      );
      return;
    }
    await this.executeCommandImmediately(
      this.dbtCommandFactory.createUpdateDBTCommand()
    );
    await this.handlePythonExtension();
  }

  async executeSQL(projectUri: Uri, sql: string) {
    const sqlCommandProcess = this.executeCommand(
      this.dbtCommandFactory.createSqlCommand(projectUri, sql)
    );
    try {
      const output = await sqlCommandProcess.complete();
      sqlCommandProcess.dispose();
      const data = JSON.parse(output);
      console.log(data);
      // TODO: show in html window
    } catch (err) {
      // TODO
    }
  }

  async listModels(projectUri: Uri): Promise<void> {
    const listModelsDisabled = workspace
      .getConfiguration("dbt")
      .get<boolean>("listModelsDisabled", false);
    if (listModelsDisabled) {
      return;
    }
    this.addCommandToQueue(
      this.dbtCommandFactory.createListCommand(projectUri)
    );
  }

  async checkIfDBTIsInstalled(): Promise<void> {
    const checkDBTInstalledProcess = this.executeCommand(
      this.dbtCommandFactory.createImportDBTCommand()
    );

    this.raiseDBTInstallationCheckEvent();
    try {
      await checkDBTInstalledProcess.complete();
    } catch (_) {
      this.raiseDBTNotInstalledEvent();
      return;
    }

    const checkDBTVersionProcess = this.executeCommand(
      this.dbtCommandFactory.createVersionCommand()
    );
    const timeoutCmd = new Promise((resolve, _) => {
      setTimeout(resolve, 10000, "Could not connect");
    });
    try {
      await Promise.race([checkDBTVersionProcess.complete(), timeoutCmd]);
      checkDBTVersionProcess.dispose();
    } catch (err) {
      if (err.match(DBTClient.IS_INSTALLED)) {
        this.checkIfDBTIsUpToDate(err);
        return;
      }
    }
    this.raiseDBTVersionCouldNotBeDeterminedEvent();
  }

  addCommandToQueue(command: DBTCommand) {
    if (!this.dbtInstalled) {
      if (command.focus) {
        window.showErrorMessage(
          "Please ensure dbt is installed in your selected Python environment."
        );
      }
      return;
    }

    this.queue.addToQueue({
      command: (token) => this.executeCommandImmediately(command, token),
      statusMessage: command.statusMessage,
      focus: command.focus,
    });
  }

  async executeCommandImmediately(
    command: DBTCommand,
    token?: CancellationToken
  ) {
    const process = this.executeCommand(command, token);
    await process.completeWithTerminalOutput(this.writeEmitter);
    process.dispose();
  }

  private executeCommand(
    command: DBTCommand,
    token?: CancellationToken
  ): CommandProcessExecution {
    const { args, cwd } = command.processExecutionParams;
    if (this.terminal === undefined) {
      this.terminal = window.createTerminal({
        name: "Tasks - dbt",
        pty: {
          onDidWrite: this.writeEmitter.event,
          open: () => this.writeEmitter.fire(""),
          close: () => {
            this.terminal?.dispose();
            this.terminal = undefined;
          },
        },
      });
    }

    if (command.commandAsString !== undefined) {
      this.writeEmitter.fire(
        `\r> Executing task:  ${command.commandAsString}\n\r\n\r`
      );

      if (command.focus) {
        this.terminal.show(true);
      }
    }

    return this.commandProcessExecutionFactory.createCommandProcessExecution(
      this.pythonPath!,
      args,
      cwd,
      token
    );
  }

  private raiseDBTInstallationCheckEvent(): void {
    this.dbtInstalled = undefined;
    this._onDBTInstallationFound.fire({});
  }

  private raiseDBTNotInstalledEvent(): void {
    this.raiseDBTVersionEvent(false);
  }

  private raiseDBTVersionCouldNotBeDeterminedEvent(): void {
    this.raiseDBTVersionEvent(true);
  }

  private raiseDBTVersionEvent(
    dbtInstalled: boolean,
    installedVersion: string | undefined = undefined,
    latestVersion: string | undefined = undefined
  ): void {
    this.dbtInstalled = dbtInstalled;
    this._onDBTInstallationFound.fire({
      installed: this.dbtInstalled,
      installedVersion,
      latestVersion,
      upToDate:
        installedVersion !== undefined &&
        latestVersion !== undefined &&
        installedVersion === latestVersion,
    });
  }

  private checkIfDBTIsUpToDate(message: string): void {
    const installedVersionMatch = message.match(DBTClient.INSTALLED_VERSION);
    if (installedVersionMatch === null) {
      throw Error(
        `The Regex INSTALLED_VERSION ${DBTClient.INSTALLED_VERSION} is not working ...`
      );
    }
    const installedVersion = installedVersionMatch[0];
    const latestVersionMatch = message.match(DBTClient.LATEST_VERSION);
    if (latestVersionMatch === null) {
      throw Error(
        `The Regex IS_LATEST_VERSION ${DBTClient.LATEST_VERSION} is not working ...`
      );
    }
    const latestVersion = latestVersionMatch[0];
    this.raiseDBTVersionEvent(true, installedVersion, latestVersion);
  }

  private async handlePythonExtension(): Promise<void> {
    const pythonEnvironment = await this.pythonEnvironment.getEnvironment();
    this.pythonPath = pythonEnvironment.getPythonPath();
    await this.checkIfDBTIsInstalled();
  }
}

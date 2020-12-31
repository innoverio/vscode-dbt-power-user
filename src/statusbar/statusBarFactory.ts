import { RunResultStatusBar } from "./runResultStatusBarProvider";
import { StatusBarItem } from "vscode";
import { dbtProjectContainer } from "../manifest/dbtProjectContainer";

export class StatusBarFactory {

  static createRunResultStatusBar(): StatusBarItem {
    const runResultStatusBar = new RunResultStatusBar();
    dbtProjectContainer.addOnManifestCacheChangedHandler(runResultStatusBar);
    return runResultStatusBar.statusBar;
  }
}

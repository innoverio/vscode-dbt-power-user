import path = require("path");
import { Disposable, window } from "vscode";
import { NodeMetaMap } from "../domain";
import { DBTProjectContainer } from "../manifest/dbtProjectContainer";
import { ManifestCacheChangedEvent } from "../manifest/event/manifestCacheChangedEvent";
import { provideSingleton } from "../utils";

@provideSingleton(ExecuteSQL)
export class ExecuteSQL {
  private disposables: Disposable[] = [];
  private modelToFQNMap: Map<string, NodeMetaMap> = new Map();

  constructor(private dbtProjectContainer: DBTProjectContainer) {
    this.disposables.push(
      dbtProjectContainer.onManifestChanged((event) =>
        this.onManifestCacheChanged(event)
      )
    );
  }

  async executeSQL() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      // TODO: get sql qualified name from graph
      const dbtProject = this.dbtProjectContainer.findDBTProject(fullPath);
      if (dbtProject === undefined) {
        return;
      }
      const nodeMap = this.modelToFQNMap.get(dbtProject.projectRoot.fsPath);
      if (nodeMap === undefined) {
        return;
      }
      const name = path.basename(fullPath.fsPath).slice(0, -4);
      const node = nodeMap.get(name);
      if (node === undefined) {
        return;
      }
      let fqn = "";
      if(node.database) {
        fqn += `${node.database}.`;
      }
      fqn += `${node.schema}.${node.alias}`;

      this.dbtProjectContainer.executeSQL(dbtProject.projectRoot, `SELECT * FROM ${fqn} LIMIT 1000`);
    }
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private onManifestCacheChanged(event: ManifestCacheChangedEvent): void {
    event.added?.forEach((added) => {
      this.modelToFQNMap.set(added.projectRoot.fsPath, added.nodeMetaMap);
    });
    event.removed?.forEach((removed) => {
      this.modelToFQNMap.delete(removed.projectRoot.fsPath);
    });
  }
}

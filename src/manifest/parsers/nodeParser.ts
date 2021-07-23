import { provide } from "inversify-binding-decorators";
import * as path from "path";
import { NodeMetaMap } from "../../domain";
import { DBTProject } from "../dbtProject";

@provide(NodeParser)
export class NodeParser {
  createModelMetaMap(nodesMap: any[]): Promise<NodeMetaMap> {
    return new Promise((resolve) => {
      const modelMetaMap: NodeMetaMap = new Map();
      if (nodesMap === null || nodesMap === undefined) {
        console.log("No nodes found in manifest!");
        resolve(modelMetaMap);
      }
      Object.values(nodesMap)
        .filter(
          (model) =>
            model.resource_type === DBTProject.RESOURCE_TYPE_MODEL ||
            model.resource_type === DBTProject.RESOURCE_TYPE_SEED ||
            model.resource_type === DBTProject.RESOURCE_TYPE_SNAPSHOT
        )
        .forEach(({ name, root_path, original_file_path, database, schema, alias }) => {
          const fullPath = path.join(root_path, original_file_path);
          modelMetaMap.set(name, { path: fullPath, database, schema, alias });
        });
      resolve(modelMetaMap);
    });
  }
}

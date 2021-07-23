import * as path from "path";

export type NodeMetaMap = Map<string, NodeMetaData>;
export type MacroMetaMap = Map<string, MacroMetaData>;
export type SourceMetaMap = Map<string, SourceMetaData>;

interface MacroMetaData {
  path: string;
  line: number;
  character: number;
}

interface NodeMetaData {
  path: string;
  database: string;
  schema: string;
  alias: string;
}

interface SourceMetaData {
  tables: SourceTable[];
}

interface SourceTable {
  name: string;
  path: string;
}

interface NodeGraphMetaData {
  nodes: Node[];
}

export type NodeGraphMap = Map<string, NodeGraphMetaData>;

export interface GraphMetaMap {
  parents: NodeGraphMap;
  children: NodeGraphMap;
}

interface IconPath {
  light: string;
  dark: string;
}

export abstract class Node {
  label: string;
  key: string;
  url: string;
  iconPath: IconPath = {
    light: path.join(path.resolve(__dirname), "../media/model_light.svg"),
    dark: path.join(path.resolve(__dirname), "../media/model_dark.svg"),
  };
  displayInModelTree: boolean = true;

  constructor(label: string, key: string, url: string) {
    this.label = label;
    this.key = key;
    this.url = url;
  }
}

export class Model extends Node {}

export class Seed extends Node {}
export class Test extends Node {
  displayInModelTree = false;
}
export class Analysis extends Node {
  displayInModelTree = false;
}
export class Exposure extends Node {
  displayInModelTree = false;
}
export class Snapshot extends Node {}
export class Source extends Node {
  iconPath = {
    light: path.join(path.resolve(__dirname), "../media/source_light.svg"),
    dark: path.join(path.resolve(__dirname), "../media/source_dark.svg"),
  };
}

export enum RunModelType {
  PARENTS,
  CHILDREN,
}
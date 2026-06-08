import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import dagre from 'dagre';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DvcYaml {
  stages: Record<string, Stage>;
}

interface Stage {
  cmd: string;
  deps?: string[];
  outs?: any[];
  meta?: {
    title?: string;
    description?: string;
    details?: any[];
    sources?: { id: string, title?: string, description?: string, details?: any[], schema?: any[] }[];
  };
}

const DVC_YAML_PATH = path.join(__dirname, '..', 'dvc.yaml');
const OUTPUT_JSON_PATH = path.join(__dirname, '..', '..', 'website', 'src', 'lib', 'pipeline_graph.json');

function isTsFile(filePath: string) {
  return filePath.endsWith('.ts');
}

function generateLayout() {
  const dvcYamlContent = fs.readFileSync(DVC_YAML_PATH, 'utf8');
  const dvcData = yaml.load(dvcYamlContent) as DvcYaml;

  const nodesMap = new Map<string, any>();
  const edges: any[] = [];

  const addNode = (id: string, type: string, label: string, dataExtras: any = {}) => {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, {
        id,
        type,
        data: { label, ...dataExtras }
      });
    }
  };

  const addEdge = (source: string, target: string) => {
    const id = `e-${source}-${target}`;
    edges.push({
      id,
      source,
      target,
      type: 'default',
      animated: false,
      style: 'stroke: #525c7a; stroke-width: 2px; opacity: 0.7; transition: stroke 0.3s, stroke-width 0.3s, opacity 0.3s;',
      selectable: false
    });
  };

  for (const [stageName, stage] of Object.entries(dvcData.stages)) {
    const stageId = stageName; // Use stage name as unique ID
    const label = stage.meta?.title || stageName;

    // Add Script Node
    addNode(stageId, 'script', label, {
      description: stage.meta?.description,
      details: stage.meta?.details,
      runCommand: stage.cmd
    });

    if (stage.meta?.sources) {
      for (const source of stage.meta.sources) {
        addNode(source.id, 'source', source.title || source.id, {
          description: source.description,
          details: source.details,
          schema: source.schema
        });
        addEdge(source.id, stageId);
      }
    }

    if (stage.deps) {
      for (const dep of stage.deps) {
        if (!isTsFile(dep) && dep !== 'dvc.yaml') {
          // File node ID is its path
          addNode(dep, 'file', dep);
          addEdge(dep, stageId);
        }
      }
    }

    if (stage.outs) {
      for (const outObj of stage.outs) {
        let outPath: string;
        let meta: any = null;

        if (typeof outObj === 'string') {
          outPath = outObj;
        } else {
          outPath = Object.keys(outObj)[0];
          meta = outObj[outPath]?.meta;
        }

        const label = meta?.title || outPath;
        addNode(outPath, 'file', label, {
          description: meta?.description,
          schema: meta?.schema,
          details: meta?.details
        });
        addEdge(stageId, outPath);
      }
    }
  }

  // Use Dagre to compute layouts
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 120,
    ranksep: 80,
    align: 'UL',
    ranker: 'longest-path'
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220;
  const nodeHeight = 80;

  for (const node of nodesMap.values()) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const rawPositions = Array.from(nodesMap.values()).map(node => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2
      }
    };
  });

  // Normalize minX and minY to 40
  let minX = Infinity;
  let minY = Infinity;
  for (const node of rawPositions) {
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
  }

  const finalNodes = rawPositions.map(node => ({
    ...node,
    position: {
      x: node.position.x - minX + 40,
      y: node.position.y - minY + 40
    }
  }));

  const result = {
    nodes: finalNodes,
    edges
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(result, null, 2));
  console.log(`Generated layout with ${finalNodes.length} nodes and ${edges.length} edges.`);
}

generateLayout();

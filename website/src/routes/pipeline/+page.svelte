<script lang="ts">
  import { onMount } from "svelte";
  import { base } from "$app/paths";
  import { SvelteFlow, Controls, Background, MiniMap } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import {
    ArrowLeft,
    Database,
    Terminal,
    FileText,
    Clock,
    ExternalLink,
    HelpCircle,
  } from "@lucide/svelte";

  import pipelineGraph from "$lib/pipeline_graph.json";

  // Import custom nodes
  import SourceNode from "$lib/components/pipeline/SourceNode.svelte";
  import ScriptNode from "$lib/components/pipeline/ScriptNode.svelte";
  import FileNode from "$lib/components/pipeline/FileNode.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { theme } from "$lib/stores/theme.svelte";

  const nodeTypes = {
    source: SourceNode,
    script: ScriptNode,
    file: FileNode,
  };

  // State
  let selectedNodeId = $state<string | null>(null);
  let hoveredNodeId = $state<string | null>(null);

  let highlightedNodes = $state(new Set<string>());
  let highlightedEdges = $state(new Set<string>());

  let nodes = $state.raw<any[]>(pipelineGraph.nodes);
  let edges = $state.raw<any[]>(pipelineGraph.edges);
  let flowInstance = $state<any>(null);

  // React to selection/hover modifications and recalculate highlighted connections
  function updateHighlighting(nodeId: string | null) {
    if (!nodeId) {
      highlightedNodes = new Set();
      highlightedEdges = new Set();
      return;
    }

    const nodesToHighlight = new Set<string>([nodeId]);
    const edgesToHighlight = new Set<string>();

    // Tracing Upstream (Ancestors)
    let queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const incomingEdges = edges.filter((e) => e.target === current);
      for (const edge of incomingEdges) {
        if (!edgesToHighlight.has(edge.id)) {
          edgesToHighlight.add(edge.id);
          nodesToHighlight.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    // Tracing Downstream (Descendants)
    queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoingEdges = edges.filter((e) => e.source === current);
      for (const edge of outgoingEdges) {
        if (!edgesToHighlight.has(edge.id)) {
          edgesToHighlight.add(edge.id);
          nodesToHighlight.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    highlightedNodes = nodesToHighlight;
    highlightedEdges = edgesToHighlight;
  }

  // Effect to update highlight when selection or hover state changes
  $effect(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    updateHighlighting(activeId);
  });

  // Update nodes highlighting using immutable updates to trigger SvelteFlow reactivity
  $effect(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    let nodesChanged = false;

    const nextNodes = nodes.map((node) => {
      const isHighlighted =
        highlightedNodes.has(node.id) || activeId === node.id;
      const isSelected = selectedNodeId === node.id;

      if (
        node.data?.highlighted !== isHighlighted ||
        node.data?.selected !== isSelected
      ) {
        nodesChanged = true;
        return {
          ...node,
          data: {
            ...node.data,
            highlighted: isHighlighted,
            selected: isSelected,
          },
        };
      }
      return node;
    });

    if (nodesChanged) {
      nodes = nextNodes;
    }
  });

  // Dynamically calculate the closest handles for edges based on current node positions
  $effect(() => {
    // Read coordinates of all nodes to register dependency
    const nodeCoords = nodes.map((n) => ({
      id: n.id,
      x: n.position?.x || 0,
      y: n.position?.y || 0,
    }));
    const nodeMap = new Map(nodeCoords.map((c) => [c.id, c]));

    const sources = ["bottom-source", "right-source"];
    const targets = ["top-target", "left-target"];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (sourceNode && targetNode) {
        let bestSource = "bottom-source";
        let bestTarget = "top-target";
        let minScore = Infinity;

        // Try all valid handle combinations and find the one that flows downstream
        for (const s of sources) {
          for (const t of targets) {
            // Node dimensions are 220px width, ~80px height
            const sx =
              sourceNode.x +
              110 +
              (s === "left-source" ? -110 : s === "right-source" ? 110 : 0);
            const sy = sourceNode.y + 40 + (s === "bottom-source" ? 40 : 0);
            const tx =
              targetNode.x +
              110 +
              (t === "left-target" ? -110 : t === "right-target" ? 110 : 0);
            const ty = targetNode.y + 40 + (t === "top-target" ? -40 : 0);

            const dx = tx - sx;
            const dy = ty - sy;

            const dist = Math.sqrt(dx * dx + dy * dy);

            // Compute penalties to prevent upstream flows
            let penalty = 0;
            if (dy < 0) {
              // Heavily penalize flowing upwards
              penalty += 5000 + Math.abs(dy) * 10;
            }
            if (dx < 0) {
              // Moderately penalize flowing leftwards (prefer left-to-right)
              penalty += 1000 + Math.abs(dx) * 2;
            }

            const score = dist + penalty;
            if (score < minScore) {
              minScore = score;
              bestSource = s;
              bestTarget = t;
            }
          }
        }

        if (
          edge.sourceHandle !== bestSource ||
          edge.targetHandle !== bestTarget
        ) {
          edges[i].sourceHandle = bestSource;
          edges[i].targetHandle = bestTarget;
        }
      }
    }
  });

  $effect(() => {
    // update edges
    for (let i = 0; i < edges.length; i++) {
      const isHighlighted = highlightedEdges.has(edges[i].id);
      if (edges[i].animated !== isHighlighted) {
        edges[i].animated = isHighlighted;
        edges[i].style = isHighlighted
          ? "stroke: var(--color-accent-violet); stroke-width: 3px; filter: drop-shadow(0px 0px 4px rgba(167, 139, 250, 0.6)); transition: stroke 0.3s, stroke-width 0.3s, opacity 0.3s, filter 0.3s;"
          : "stroke: #525c7a; stroke-width: 2px; opacity: 0.7; transition: stroke 0.3s, stroke-width 0.3s, opacity 0.3s, filter 0.3s;";
      }
    }
  });

  // Inspector details
  const activeInspectorData = $derived.by(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;
    return {
      type: node.type,
      title: node.data.label,
      description: node.data.description,
      details: node.data.details,
      schema: node.data.schema,
      runCommand: node.data.runCommand,
      duration: node.data.duration,
    };
  });

  const scriptInputs = $derived(
    (selectedNodeId && activeInspectorData?.type === "script"
      ? edges
          .filter((e) => e.target === selectedNodeId)
          .map((e) => nodes.find((n) => n.id === e.source))
          .filter(Boolean)
      : []) as any[],
  );

  const scriptOutputs = $derived(
    (selectedNodeId && activeInspectorData?.type === "script"
      ? edges
          .filter((e) => e.source === selectedNodeId)
          .map((e) => nodes.find((n) => n.id === e.target))
          .filter(Boolean)
      : []) as any[],
  );

  function handleNodeClick({
    event,
    node,
  }: {
    event: MouseEvent | TouchEvent;
    node: any;
  }) {
    const clickedNodeId = node.id;
    if (selectedNodeId === clickedNodeId) {
      selectedNodeId = null;
    } else {
      selectedNodeId = clickedNodeId;
    }
  }

  function handlePaneClick({ event }: { event: MouseEvent }) {
    selectedNodeId = null;
  }

  function handleNodePointerEnter({
    event,
    node,
  }: {
    event: PointerEvent;
    node: any;
  }) {
    hoveredNodeId = node.id;
  }

  function handleNodePointerLeave({
    event,
    node,
  }: {
    event: PointerEvent;
    node: any;
  }) {
    hoveredNodeId = null;
  }

  function handleNodeDragStop() {
    nodes = nodes.map((n) => ({ ...n, selected: false }));
  }

  function handleFlowInit(instance: any) {
    flowInstance = instance;
  }

  onMount(() => {
    setTimeout(() => {
      if (flowInstance) {
        flowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
      }
    }, 50);
  });
</script>

<div class="pipeline-container">
  <!-- Top Navigation Header -->
  <header class="pipeline-header">
    <div class="header-left">
      <a href="{base}/" class="back-btn" aria-label="Go back to dashboard">
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </a>
      <div class="header-divider"></div>
      <div class="header-title-wrap">
        <h1>Data Processing Pipeline</h1>
      </div>
    </div>
    <div class="header-right">
      <div class="legend-indicator">
        <span class="legend-dot source-dot"></span><span>Sources</span>
        <span class="legend-dot script-dot"></span><span>Scripts</span>
        <span class="legend-dot file-dot"></span><span>Files</span>
      </div>
      <ThemeToggle />
    </div>
  </header>

  <!-- Flow Area -->
  <div class="flow-layout">
    <div
      class="flow-viewport"
      class:has-active={!!(hoveredNodeId || selectedNodeId)}
    >
      <SvelteFlow
        bind:nodes
        bind:edges
        {nodeTypes}
        colorMode={theme.isDark ? "dark" : "light"}
        panOnDrag={true}
        selectionOnDrag={false}
        panOnScroll={true}
        oninit={handleFlowInit as any}
        onnodeclick={handleNodeClick}
        onpaneclick={handlePaneClick}
        onnodepointerenter={handleNodePointerEnter}
        onnodepointerleave={handleNodePointerLeave}
        onnodedragstop={handleNodeDragStop}
      >
        <Background
          bgColor="var(--bg-base)"
          patternColor="var(--bg-pattern)"
          gap={24}
          size={1.5}
        />
        <div
          style="position: absolute; bottom: 15px; left: 15px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; z-index: 5;"
        >
          <Controls
            orientation="horizontal"
            showLock={false}
            style="margin: 0; position: static;"
          />
          <MiniMap
            style="background: var(--bg-surface); border: 1px solid var(--border-base); border-radius: 8px; margin: 0; position: static;"
            pannable
            zoomable
          />
        </div>
      </SvelteFlow>
    </div>

    <!-- Right Metadata Inspector Drawer -->
    <aside class="metadata-inspector" class:open={!!activeInspectorData}>
      {#if activeInspectorData}
        <div class="inspector-header">
          <div
            class="inspector-badge"
            class:source={activeInspectorData.type === "source"}
            class:script={activeInspectorData.type === "script"}
            class:file={activeInspectorData.type === "file"}
          >
            {#if activeInspectorData.type === "source"}
              <Database size={12} />
              <span>API</span>
            {:else if activeInspectorData.type === "script"}
              <Terminal size={12} />
              <span>SCRIPT</span>
            {:else if activeInspectorData.type === "file"}
              <FileText size={12} />
              <span>FILE</span>
            {/if}
          </div>
          <button
            class="close-inspector-btn"
            onclick={() => (selectedNodeId = null)}>&times;</button
          >
        </div>

        <div class="inspector-body">
          <h2>{activeInspectorData.title}</h2>
          <p class="inspector-desc">{activeInspectorData.description}</p>

          <!-- Run commands / details for scripts -->
          {#if activeInspectorData.runCommand}
            <div class="inspector-section script-actions">
              <h3><Terminal size={13} /> Run with</h3>
              <div class="command-box">
                <code>{activeInspectorData.runCommand}</code>
              </div>
              {#if activeInspectorData.duration}
                <div class="duration-badge">
                  <Clock size={12} />
                  <span>Est. Duration: {activeInspectorData.duration}</span>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Details Key-Value Attributes -->
          {#if activeInspectorData.details && activeInspectorData.details.length > 0}
            <div class="inspector-section">
              <h3>Properties</h3>
              <div class="properties-list">
                {#each activeInspectorData.details as detail}
                  <div class="property-row">
                    <span class="prop-label">{detail.label}</span>
                    {#if detail.isLink}
                      <a
                        href={detail.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="prop-value link"
                      >
                        <span>{detail.value}</span>
                        <ExternalLink size={10} />
                      </a>
                    {:else}
                      <span class="prop-value font-mono">{detail.value}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Script Inputs/Outputs -->
          {#if activeInspectorData.type === "script"}
            <div class="inspector-section">
              <h3>Inputs</h3>
              <div class="properties-list">
                {#each scriptInputs as input}
                  <div class="property-row">
                    <span class="prop-value font-mono"
                      >{input?.data?.label}</span
                    >
                  </div>
                {:else}
                  <div class="property-row">
                    <span class="prop-value font-mono opacity-50">None</span>
                  </div>
                {/each}
              </div>
            </div>

            <div class="inspector-section">
              <h3>Script</h3>
              <div class="properties-list">
                <div class="property-row">
                  <span class="prop-value font-mono"
                    >{activeInspectorData.details?.find(
                      (d: any) => d.label === "Script Location",
                    )?.value || activeInspectorData.title}</span
                  >
                </div>
              </div>
            </div>

            <div class="inspector-section">
              <h3>Outputs</h3>
              <div class="properties-list">
                {#each scriptOutputs as output}
                  <div class="property-row">
                    <span class="prop-value font-mono"
                      >{output?.data?.label}</span
                    >
                  </div>
                {:else}
                  <div class="property-row">
                    <span class="prop-value font-mono opacity-50">None</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Schema Viewer for Cache Files -->
          {#if activeInspectorData.schema && activeInspectorData.schema.length > 0}
            <div class="inspector-section">
              <h3>Schema Fields</h3>
              {#if activeInspectorData.details
                ?.find((d: any) => d.label === "Format")
                ?.value?.includes("Array")}
                <div class="schema-array-label">Array of:</div>
              {/if}
              <div class="schema-table">
                {#each activeInspectorData.schema as row}
                  <div class="schema-row">
                    <div class="schema-meta">
                      <span class="schema-field">{row.field}</span>
                      <span class="schema-type">{row.type}</span>
                    </div>
                    <p class="schema-desc">{row.desc}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-inspector">
          <HelpCircle size={36} class="help-icon" />
          <h3>No Node Selected</h3>
          <p>
            Click any step in the pipeline flow to view details, parameters,
            file schemas, or execution commands.
          </p>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  :global(:root) {
    --bg-base: #f8fafc;
    --bg-surface: #ffffff;
    --bg-surface-hover: #f1f5f9;
    --bg-pattern: var(--color-text-primary);

    --border-base: var(--color-text-primary);
    --border-hover: #cbd5e1;

    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --text-tertiary: #94a3b8;

    --color-source: #3b82f6;
    --color-source-light: #2563eb;
    --color-source-bg: rgba(59, 130, 246, 0.1);
    --color-source-border: rgba(59, 130, 246, 0.3);

    --color-script: #10b981;
    --color-script-light: #059669;
    --color-script-bg: rgba(16, 185, 129, 0.1);
    --color-script-border: rgba(16, 185, 129, 0.3);

    --color-file: #f59e0b;
    --color-file-light: #d97706;
    --color-file-bg: rgba(245, 158, 11, 0.1);
    --color-file-border: rgba(245, 158, 11, 0.3);
  }

  :global(:root.dark) {
    --bg-base: #0a0a0a;
    --bg-surface: #121212;
    --bg-surface-hover: #262626;
    --bg-pattern: #1a1a1a;

    --border-base: #262626;
    --border-hover: #404040;

    --text-primary: #e5e5e5;
    --text-secondary: #a3a3a3;
    --text-tertiary: #737373;

    --color-source: #3b82f6;
    --color-source-light: #60a5fa;
    --color-source-bg: rgba(59, 130, 246, 0.08);
    --color-source-border: rgba(59, 130, 246, 0.2);

    --color-script: #10b981;
    --color-script-light: #34d399;
    --color-script-bg: rgba(16, 185, 129, 0.08);
    --color-script-border: rgba(16, 185, 129, 0.2);

    --color-file: #f59e0b;
    --color-file-light: #fbbf24;
    --color-file-bg: rgba(245, 158, 11, 0.08);
    --color-file-border: rgba(245, 158, 11, 0.2);
  }

  .pipeline-container {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg-base);
    overflow: hidden;
  }

  .pipeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 24px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-base);
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-base);
    transition: all 0.2s;
  }

  .back-btn:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
    border-color: var(--border-hover);
  }

  .header-divider {
    height: 24px;
    width: 1px;
    background: var(--border-base);
  }

  .header-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  h1 {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .legend-indicator {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .source-dot {
    background: var(--color-source);
  }
  .script-dot {
    background: var(--color-script);
  }
  .file-dot {
    background: var(--color-file);
  }

  .flow-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .flow-viewport {
    flex: 1;
    position: relative;
    height: 100%;
  }

  :global(
      .flow-viewport.has-active .node-wrapper:not(.highlighted):not(.selected)
    ) {
    opacity: 0.4;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(.svelte-flow__controls) {
    background: var(--bg-surface) !important;
    border: 1px solid var(--border-base) !important;
    border-radius: 8px !important;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  /* Hide the interactive lock button and selection tool forcefully */
  :global(.svelte-flow__controls button[title="toggle interactivity"]),
  :global(.svelte-flow__controls button.svelte-flow__controls-interactive),
  :global(.svelte-flow__controls button[title="selection"]),
  :global(.svelte-flow__controls button[class*="selection"]) {
    display: none !important;
  }

  :global(.svelte-flow__controls button) {
    background: transparent !important;
    border-right: 1px solid var(--border-base) !important;
    border-bottom: none !important;
    color: var(--text-secondary) !important;
    fill: currentColor !important;
  }

  :global(.svelte-flow__controls button:last-child) {
    border-right: none !important;
  }

  :global(.svelte-flow__controls button:hover) {
    background: var(--bg-surface-hover) !important;
    color: var(--text-primary) !important;
  }

  /* Right metadata inspector drawer */
  .metadata-inspector {
    width: 360px;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-base);
    height: 100%;
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 8;
  }

  @media (max-width: 768px) {
    .metadata-inspector {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      transform: translateX(100%);
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    }

    .metadata-inspector.open {
      transform: translateX(0);
    }
  }

  .inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-base);
  }

  .inspector-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }

  .inspector-badge.source {
    background: var(--color-source-bg);
    border: 1px solid var(--color-source-border);
    color: var(--color-source-light);
  }
  .inspector-badge.script {
    background: var(--color-script-bg);
    border: 1px solid var(--color-script-border);
    color: var(--color-script-light);
  }
  .inspector-badge.file {
    background: var(--color-file-bg);
    border: 1px solid var(--color-file-border);
    color: var(--color-file-light);
  }

  .close-inspector-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 24px;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-inspector-btn:hover {
    color: var(--text-primary);
  }

  .inspector-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .inspector-body h2 {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .inspector-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .inspector-section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .command-box {
    background: var(--bg-base);
    border: 1px solid var(--border-base);
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 8px;
    font-family: monospace;
    font-size: 12px;
    color: var(--color-script-light);
    word-break: break-all;
    user-select: all;
  }

  .duration-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .properties-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-base);
    border-radius: 8px;
    padding: 12px;
  }

  .property-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .prop-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-tertiary);
    font-weight: 600;
  }

  .prop-value {
    font-size: 12px;
    color: var(--text-primary);
    word-break: break-all;
  }

  .prop-value.font-mono {
    font-family: monospace;
  }

  .prop-value.link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-source-light);
    text-decoration: none;
  }

  .prop-value.link:hover {
    text-decoration: underline;
  }

  .schema-table {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-base);
    border-radius: 8px;
    overflow: hidden;
  }

  .schema-row {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-base);
  }

  .schema-row:last-child {
    border-bottom: none;
  }

  .schema-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .schema-field {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 600;
  }

  .schema-type {
    padding: 2px 6px;
    background: var(--bg-surface-hover);
    color: var(--text-secondary);
    border-radius: 4px;
    font-family: monospace;
    font-size: 10px;
  }

  .schema-desc {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .schema-array-label {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 6px;
    font-style: italic;
  }

  .empty-inspector {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    height: 100%;
    padding: 40px;
    color: var(--text-secondary);
  }

  .empty-inspector h3 {
    margin: 16px 0 8px 0;
    font-size: 16px;
    color: var(--text-primary);
  }

  .empty-inspector p {
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }

  :global(.help-icon) {
    color: var(--border-hover);
    opacity: 0.5;
  }
</style>

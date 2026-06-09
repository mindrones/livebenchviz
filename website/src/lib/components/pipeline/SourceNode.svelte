<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { Database } from '@lucide/svelte';

  let { data } = $props();
  let highlighted = $derived(data.highlighted);
</script>

<div 
  class="node-wrapper source-node" 
  class:highlighted
  class:selected={data.selected}
>
  <div class="node-header">
    <div class="icon-container">
      <Database size={16} />
    </div>
    <span class="node-type">SOURCE</span>
  </div>
  
  <div class="node-content">
    <div class="node-title">{data.label}</div>
  </div>

  <!-- Source handles on all four sides -->
  <Handle id="top-source" type="source" position={Position.Top} class="flow-handle" />
  <Handle id="right-source" type="source" position={Position.Right} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
  <Handle id="bottom-source" type="source" position={Position.Bottom} class="flow-handle" />
  <Handle id="left-source" type="source" position={Position.Left} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
</div>

<style>
  .node-wrapper {
    background: var(--color-bg-toast);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 12px 14px;
    width: 220px;
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .node-wrapper::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 10px 10px 0 0;
    background: linear-gradient(90deg, #3b82f6, var(--color-accent));
  }

  .node-wrapper.highlighted {
    border-color: var(--color-accent);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
    transform: scale(1.02);
  }

  .node-wrapper.selected {
    background: var(--color-text-primary);
    border-color: #ffffff;
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
  }

  .node-wrapper.selected .node-title,
  .node-wrapper.selected .node-type,
  .node-wrapper.selected .icon-container {
    color: var(--color-bg-primary) !important;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .icon-container {
    color: #3b82f6;
    display: flex;
    align-items: center;
  }

  .node-type {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
  }

  .node-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .node-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    word-break: break-all;
    line-height: 1.4;
  }

  .node-desc {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.3;
  }

  :global(.flow-handle) {
    background: var(--color-border) !important;
    border: 2px solid var(--color-bg-surface) !important;
    width: 8px !important;
    height: 8px !important;
    transition: all 0.2s;
  }

  .node-wrapper.highlighted :global(.flow-handle) {
    background: var(--color-accent) !important;
    transform: scale(1.2);
  }
</style>

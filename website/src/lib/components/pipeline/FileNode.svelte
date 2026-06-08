<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { FileText } from '@lucide/svelte';

  let { data } = $props();
  let highlighted = $derived(data.highlighted);
</script>

<div 
  class="node-wrapper file-node" 
  class:highlighted
  class:selected={data.selected}
>
  <div class="node-header">
    <div class="icon-container">
      <FileText size={16} />
    </div>
    <span class="node-type">INTERMEDIATE FILE</span>
  </div>
  
  <div class="node-content">
    <div class="node-title">{data.label}</div>
  </div>

  <!-- Target handles on all four sides -->
  <Handle id="top-target" type="target" position={Position.Top} class="flow-handle" />
  <Handle id="right-target" type="target" position={Position.Right} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
  <Handle id="bottom-target" type="target" position={Position.Bottom} class="flow-handle" />
  <Handle id="left-target" type="target" position={Position.Left} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />

  <!-- Source handles on all four sides -->
  <Handle id="top-source" type="source" position={Position.Top} class="flow-handle" />
  <Handle id="right-source" type="source" position={Position.Right} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
  <Handle id="bottom-source" type="source" position={Position.Bottom} class="flow-handle" />
  <Handle id="left-source" type="source" position={Position.Left} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
</div>

<style>
  .node-wrapper {
    background: rgba(26, 29, 39, 0.85);
    border: 1px solid #2e3250;
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
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }

  .node-wrapper.highlighted {
    border-color: #f59e0b;
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
    transform: scale(1.02);
  }

  .node-wrapper.selected {
    background: #e2e8f0;
    border-color: #ffffff;
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
  }

  .node-wrapper.selected .node-title,
  .node-wrapper.selected .node-type,
  .node-wrapper.selected .icon-container {
    color: #0f1117 !important;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .icon-container {
    color: #f59e0b;
    display: flex;
    align-items: center;
  }

  .node-type {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #8892a4;
  }

  .node-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .node-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    word-break: break-all;
    line-height: 1.4;
  }

  .fields-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .field-pill {
    font-size: 10px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border-radius: 4px;
    padding: 1px 4px;
    font-family: monospace;
  }

  .field-pill.more {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.1);
    color: #8892a4;
  }

  :global(.flow-handle) {
    background: #2e3250 !important;
    border: 2px solid #1a1d27 !important;
    width: 8px !important;
    height: 8px !important;
    transition: all 0.2s;
  }

  .node-wrapper.highlighted :global(.flow-handle) {
    background: #f59e0b !important;
    transform: scale(1.2);
  }
</style>

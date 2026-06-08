<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { LayoutDashboard } from '@lucide/svelte';

  let { data } = $props();
  let highlighted = $derived(data.highlighted);
</script>

<div 
  class="node-wrapper output-node" 
  class:highlighted
  class:selected={data.selected}
>
  <div class="glow-effect"></div>
  
  <div class="node-header">
    <div class="icon-container">
      <LayoutDashboard size={16} />
    </div>
    <span class="node-type">FINAL OUTPUT</span>
  </div>
  
  <div class="node-content">
    <div class="node-title">{data.label}</div>
    {#if data.description}
      <div class="node-desc">{data.description}</div>
    {/if}
  </div>

  <!-- Target handles on all four sides -->
  <Handle id="top-target" type="target" position={Position.Top} class="flow-handle" />
  <Handle id="right-target" type="target" position={Position.Right} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
  <Handle id="bottom-target" type="target" position={Position.Bottom} class="flow-handle" />
  <Handle id="left-target" type="target" position={Position.Left} class="flow-handle" style="top: 50%; transform: translateY(-50%);" />
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
    background: linear-gradient(90deg, #a78bfa, #ec4899);
  }

  .node-wrapper.highlighted {
    border-color: #a78bfa;
    box-shadow: 0 0 15px rgba(167, 139, 250, 0.4);
    transform: scale(1.02);
  }

  .node-wrapper.selected {
    border-color: #c084fc;
    box-shadow: 0 0 20px rgba(192, 132, 252, 0.6);
  }

  .glow-effect {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: radial-gradient(circle at 50% 0%, rgba(167, 139, 250, 0.15), transparent 70%);
    pointer-events: none;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .icon-container {
    color: #a78bfa;
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
    gap: 4px;
  }

  .node-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    word-break: break-all;
    line-height: 1.4;
  }

  .node-desc {
    font-size: 11px;
    color: #8892a4;
    line-height: 1.3;
  }

  :global(.flow-handle) {
    background: #2e3250 !important;
    border: 2px solid #1a1d27 !important;
    width: 8px !important;
    height: 8px !important;
    transition: all 0.2s;
  }

  .node-wrapper.highlighted :global(.flow-handle) {
    background: #a78bfa !important;
    transform: scale(1.2);
  }
</style>

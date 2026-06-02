<script lang="ts">
  import { Info } from '@lucide/svelte';

  interface Props {
    show: boolean;
    onclose: () => void;
  }

  let { show, onclose }: Props = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->

{#if show}
  <div class="overlay" onclick={onclose} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2><Info size="18" /> LiveBench Citation</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <p>
          <a href="https://livebench.ai" target="_blank" rel="noopener noreferrer">
            livebench.ai →
          </a>
        </p>
        <pre><code>{`@inproceedings{livebench,
  title={LiveBench: A Challenging, Contamination-Free {LLM} Benchmark},
  author={Colin White and Samuel Dooley and Manley Roberts and Arka Pal and Benjamin Feuer and Siddhartha Jain and Ravid Shwartz-Ziv and Neel Jain and Khalid Saifullah and Sreemanti Dey and Shubh-Agrawal and Sandeep Singh Sandha and Siddartha Venkat Naidu and Chinmay Hegde and Yann LeCun and Tom Goldstein and Willie Neiswanger and Micah Goldblum},
  booktitle={The Thirteenth International Conference on Learning Representations},
  year={2025},
}`}</code></pre>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.65);
    display: flex; align-items: center; justify-content: center; z-index: 1000;
  }
  .modal {
    background: #1a1d27; border: 1px solid #2e3250; border-radius: 12px;
    width: 560px; max-width: 90vw; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 16px 48px rgba(0,0,0,.5);
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid #2e3250;
  }
  .modal-header h2 {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 700; color: #e2e8f0;
  }
  .close-btn {
    background: transparent; border: 1px solid #2e3250; border-radius: 5px;
    color: #8892a4; font-size: 14px; padding: 4px 8px; cursor: pointer;
  }
  .close-btn:hover { color: #e2e8f0; border-color: #6366f1; }
  .modal-body { padding: 16px 20px 20px; }
  .modal-body p { margin-bottom: 12px; }
  .modal-body a {
    color: #818cf8; text-decoration: none; font-weight: 600; font-size: 14px;
  }
  .modal-body a:hover { text-decoration: underline; }
  .modal-body pre {
    background: #141620; border: 1px solid #2e3250; border-radius: 8px;
    padding: 14px 16px; overflow-x: auto; margin: 0;
  }
  .modal-body code {
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
    font-size: 12px; line-height: 1.6; color: #a5b4fc;
  }
</style>

export const tooltipState = $state({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  content: ''
});

export function showTooltip(e: PointerEvent, title: string, content: string) {
  tooltipState.visible = true;
  tooltipState.x = e.clientX;
  tooltipState.y = e.clientY;
  tooltipState.title = title;
  tooltipState.content = content;
}

export function hideTooltip() {
  tooltipState.visible = false;
}

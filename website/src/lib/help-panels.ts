/**
 * Help panel data — shared between HelpModal and MobileHelpPanel.
 */
export interface HelpPanel {
  title: string;
  body: string;
}

export const HELP_PANELS: HelpPanel[] = [
  {
    title: 'Timeline Brush',
    body: 'Drag the left or right handle on the release timeline to zoom into a date range. Models released outside the brush are hidden. Click outside the brush to re-center it. Use the quick-select buttons (6 M, 1 Y, 2 Y, 3 Y, All) to jump to common ranges.',
  },
  {
    title: 'Release Timeline Hover',
    body: 'Hover over the timeline track to snap to the nearest model release date. A red marker appears and the matching curve(s) highlight in the chart with a count label.',
  },
  {
    title: 'Hovering Curves',
    body: 'Move your cursor over any curve in the parallel-coordinates chart to highlight it. The curve turns white and score labels appear at each axis crossing. Hovering a sidebar row highlights the same curve — the link works both ways.',
  },
  {
    title: 'Selecting Curves',
    body: 'Click a highlighted curve or sidebar row to add it to your selection (up to 8). Selected curves appear in white and are listed as pills at the top of the chart. Click a pill\'s × to remove one, or "Clear all" to deselect everything. Click a selected curve again to toggle it off.',
  },
  {
    title: 'Axis Brushing',
    body: 'Drag vertically on any axis line to create a range filter. Only models whose score falls within every active brush remain fully visible; the rest dim. Each brush shows its range values and a small × to clear it. A "Clear all filters" link appears when any brush is active.',
  },
  {
    title: 'Axis Reordering',
    body: 'Grip the ⠿ icon next to any axis title and drag horizontally. The axis slides to its new position and the chart updates instantly. Reorder persists for the session.',
  },
  {
    title: 'Sort Axis Click',
    body: 'When sidebar sort is set to Category, click any axis title in the chart to switch the sort metric. The selected axis name appears in the sidebar sort hint.',
  },
  {
    title: 'Source Filters',
    body: 'Four checkboxes control which inference sources are visible: OpenRouter, Ollama Cloud, Ollama Download, and Other. Uncheck a source to remove all models available through it from the chart and sidebar.',
  },
  {
    title: 'Open / Closed Weights',
    body: 'Two toggle buttons switch Open Weights (🟢) and Closed Weights (🟡) on or off. Focus on only open-source or only proprietary models with one click.',
  },
  {
    title: 'Search',
    body: 'Type in the search field to filter by model name or provider family. The chart and sidebar update in real time. Hit the × to clear.',
  },
  {
    title: 'Sort Modes',
    body: 'Choose between three sorts: Category (ordered by score on the selected axis), Count (by model count or newest first in flat mode), or A–Z Name (alphabetical).',
  },
  {
    title: 'Group by Provider',
    body: 'Toggle "Group by provider" to switch between a tree view where families are expandable/collapsible and a flat alphabetical list.',
  },
  {
    title: 'Expand & Collapse',
    body: 'In grouped mode, click a family row to expand or collapse it. "Expand all" and "Collapse all" batch buttons open or close every family at once.',
  },
  {
    title: 'Model Visibility',
    body: 'Each model and family has a checkbox. Uncheck to hide a curve from the chart without removing it from the dataset. "Select all" and "Deselect all" toggle every visible model at once.',
  },
  {
    title: 'Latest 2 per Series',
    body: 'Enable "Show latest 2 per series" to keep only the two most recent models in every family. Older revisions fade out of the chart and sidebar.',
  },
  {
    title: 'URL Persistence',
    body: 'Every toggle, selection, sort choice, brush range, and search term is saved to the URL query string. Bookmark or share the URL to recreate your exact view.',
  },
  {
    title: 'Reset',
    body: 'The ↺ Reset button restores all filters, selections, brushes, and sort choices to their defaults.',
  },
];
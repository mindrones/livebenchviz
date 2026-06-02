# Usage Guide

This very guide is present as a interactive tool tip in the app.

## Timeline Brush

Drag the left or right handle on the release timeline to zoom into a date range. Models released outside the brush are hidden from both the chart and the sidebar. Click anywhere outside the brush to re-center it. Use the **6 M**, **1 Y**, **2 Y**, **3 Y**, and **All** quick-select buttons to jump to common ranges. Hover over the timeline track to see the exact release date and how many models match.

## Hovering Curves

Move your cursor over any curve in the parallel-coordinates chart to highlight it. The curve turns white, its family color intensifies, and score labels appear at each axis crossing. Hovering a row in the sidebar produces the same highlight in the chart — the link goes both ways.

## Selecting Curves

Click a highlighted curve (or a sidebar row) to add it to your selection, up to 8 models. Selected curves are drawn in white and listed as pills at the top of the chart. Click a pill's × to remove one model, or "Clear all" to deselect everything. Click a selected curve again to remove it.

## Axis Brushing

Drag vertically on any axis line to create a range filter. Only models whose score falls within every active brush remain fully visible; the rest dims to near-transparent. Each active brush shows its range values and a small × to clear it. A "Clear all filters" link appears when any brush is active.

## Axis Reordering

Grip the ⠿ icon next to any axis title and drag it horizontally. The axis slides to its new position and the chart updates instantly. Reorder sticks for the session.

## Sort Axis Click

When sidebar sort is set to **Category**, click any axis title in the chart to switch the sort metric. The highlighted axis name appears in the sidebar sort hint.

## Source Filters

Four checkboxes control which inference sources are visible: **OpenRouter**, **Ollama Cloud**, **Ollama Download**, and **Other**. Uncheck a source to remove all models available through it from both the chart and sidebar.

## Open / Closed Weights

Two toggle buttons switch **Open Weights** (🟢) and **Closed Weights** (🟡) on or off. Use them to focus on only open-source or only proprietary models.

## Search

Type in the search field to filter by model name or provider family. The chart and sidebar update in real time as you type. Hit the × to clear.

## Sort Modes

Choose between three sorts for the sidebar:

- **Category** — groups or rows are ordered by their score on the selected benchmark axis.
- **Count** — families sorted by visible-model count (grouped mode) or by release date, newest first (flat mode).
- **A–Z Name** — alphabetical order.

## Group by Provider

Toggle the **Group by provider** checkbox to switch between a tree view (families expandable/collapsible) and a flat alphabetical list.

## Expand & Collapse

In grouped mode, click a family row to expand or collapse it. Use **Expand all** / **Collapse all** batch buttons to open or close every family at once.

## Model Visibility

Each model and family has a checkbox. Uncheck to hide a curve from the chart without removing it from the dataset. "Select all" and "Deselect all" toggle every visible model at once.

## Latest 2 per Series

Enable **Show latest 2 per series** to keep only the two most recent models in every family. Older revisions are dimmed out of the chart and sidebar.

## Release Timeline Hover

Hovering over the timeline track snaps to the nearest visible model's release date, shows a red marker, and highlights the matching curve(s) in the chart with a count label.

## URL Persistence

Every toggle, selection, sort choice, brush range, and search term is saved to the URL query string. Bookmark or share the URL to recreate your exact view. Resetting the filters restores a clean URL.

## Reset

The **↺ Reset** button restores all filters, selections, brushes, and sort choices to their defaults.

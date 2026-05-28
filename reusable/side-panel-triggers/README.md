# Side Panel Trigger Variants

Reusable Nexus-style side panel trigger ideas.

## Variants

- `rail` - slim edge rail with a pulse dot and hover label.
- `infinity` - animated infinity loop with an arrow that flips direction when open.
- `compass` - small floating compass button.
- `ribbon` - folded edge ribbon.
- `magnetic` - nearly invisible edge glow that expands on hover.
- `capsule` - compact vertical capsule.

## Usage

```jsx
import SidePanelTrigger from './SidePanelTrigger.jsx';
import './side-panel-triggers.css';

<SidePanelTrigger
  variant="infinity"
  open={panelOpen}
  onClick={() => setPanelOpen((current) => !current)}
/>
```

## Props

- `variant`: one of `rail`, `compass`, `ribbon`, `magnetic`, `capsule`
- `open`: boolean
- `onClick`: function
- `labelOpen`: accessible label when opening
- `labelClose`: accessible label when closing
- `className`: optional extra class

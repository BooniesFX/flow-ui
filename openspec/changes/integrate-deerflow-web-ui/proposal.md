## Why
The current deer-flow web UI lacks detailed node visualization capabilities that would enhance the research visualization experience. The integration plan outlines how to incorporate node detail functionality from deep-research-web-ui into deer-flow's existing MultiAgentVisualization component.

## What Changes
- Enhance the AgentNode component with click handlers and visual feedback for selected nodes
- Create a Node Detail Component with sections for error display, research activities, tool call results, and reasoning content
- Integrate the node detail viewing with the ResearchBlock component through a side panel
- Implement a data transformation layer to convert deer-flow's linear Message structure to node-like data
- Extend state management to handle node selection and dynamic updates
- Add UI/UX enhancements including visual connection lines, zoom/pan controls, and search/filter functionality

## Impact
- Affected specs: web-ui
- Affected code: web/src/app/chat/components/, web/src/core/store/, web/src/components/
- Estimated effort: 50-75 hours
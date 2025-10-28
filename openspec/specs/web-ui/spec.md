# web-ui Specification

## Purpose
TBD - created by archiving change integrate-deerflow-web-ui. Update Purpose after archive.
## Requirements
### Requirement: Interactive Agent Nodes
The AgentNode component SHALL support click handlers and visual feedback for selected nodes, including status indicators similar to deep-research-web-ui.

#### Scenario: Node selection
- **WHEN** a user clicks on an agent node in the visualization
- **THEN** the node becomes visually highlighted and a detail panel appears

#### Scenario: Node deselection
- **WHEN** a user clicks on the close button of the detail panel
- **THEN** the node selection is cleared and the detail panel is hidden

### Requirement: Node Detail Component
The system SHALL provide a Node Detail Component with sections for error display, research activities, tool call results, and reasoning content.

#### Scenario: Error display
- **WHEN** a node has execution errors
- **THEN** the detail component displays the error with retry functionality

#### Scenario: Research activity details
- **WHEN** a node contains research activity information
- **THEN** the detail component displays the research activities in a structured format

#### Scenario: Tool call results
- **WHEN** a node contains tool call results
- **THEN** the detail component visualizes the results appropriately

#### Scenario: Reasoning content
- **WHEN** a node contains reasoning content
- **THEN** the detail component displays the reasoning in a readable format

### Requirement: Data Transformation
The system SHALL provide adapters to convert deer-flow's linear Message structure to node-like data for visualization.

#### Scenario: Message to node conversion
- **WHEN** workflow messages are generated
- **THEN** they are transformed into node structures with appropriate labels and content

#### Scenario: Tool call mapping
- **WHEN** messages contain tool calls
- **THEN** the tool call results are extracted and mapped to node properties

### Requirement: State Management
The system SHALL extend the existing MAV store to handle node selection state and dynamic updates.

#### Scenario: Node selection
- **WHEN** a user selects a node
- **THEN** the selection state is updated in the store

#### Scenario: Dynamic updates
- **WHEN** new activities are added during research
- **THEN** the visualization updates in real-time

### Requirement: UI/UX Enhancements
The system SHALL provide visual connection lines, zoom/pan controls, and search/filter functionality for better navigation.

#### Scenario: Visual connections
- **WHEN** nodes have relationships
- **THEN** visual connection lines are displayed between them

#### Scenario: Zoom and pan
- **WHEN** a user interacts with the visualization
- **THEN** zoom and pan controls are available for navigation

#### Scenario: Search and filter
- **WHEN** a user has a large research tree
- **THEN** search and filter functionality is available to find specific nodes


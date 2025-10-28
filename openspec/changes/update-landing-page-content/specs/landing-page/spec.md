## ADDED Requirements
### Requirement: Generic Research Platform Branding
The landing page SHALL present itself as a generic open deep research platform without deer-flow specific branding.

#### Scenario: Platform identity display
- **WHEN** users visit the landing page
- **THEN** they see "开放深度研究平台" as the platform name
- **AND** all deer-flow references are removed

#### Scenario: Bilingual platform description
- **WHEN** users view the platform description
- **THEN** content is displayed in both Chinese and English
- **AND** language切换功能正常工作

### Requirement: Latest Reporter Showcase
The landing page SHALL display and provide access to the latest generated reporters.

#### Scenario: Homepage reporter listing
- **WHEN** users visit the homepage
- **THEN** they see a list of recently generated reporters
- **AND** each reporter can be directly replayed from the homepage

#### Scenario: Reporter replay integration
- **WHEN** users click on a reporter in the homepage list
- **THEN** the reporter opens in replay mode
- **AND** all replay controls function as expected

### Requirement: User Settings Management
The platform SHALL provide user-configurable settings through a top-right settings button.

#### Scenario: Settings access
- **WHEN** users click the settings button in the top-right corner
- **THEN** a settings modal opens
- **AND** users can modify conf.yaml configuration options

#### Scenario: Configuration persistence
- **WHEN** users modify settings in the settings modal
- **THEN** changes are saved to conf.yaml
- **AND** settings persist across browser sessions

### Requirement: Configuration Options UI
The settings interface SHALL expose configurable options from conf.yaml in a user-friendly format.

#### Scenario: Basic configuration options
- **WHEN** users access settings
- **THEN** they can modify language preferences, theme, and basic platform settings
- **AND** changes take effect immediately

#### Scenario: Advanced configuration options
- **WHEN** advanced users access settings
- **THEN** they can modify technical settings from conf.yaml
- **AND** validation prevents invalid configurations

## MODIFIED Requirements
### Requirement: Landing Page Structure
The landing page SHALL maintain its existing layout and component structure while updating content.

#### Scenario: Preserved navigation
- **WHEN** users navigate the site
- **THEN** all existing navigation elements work as before
- **AND** only content labels have changed

#### Scenario: Component functionality
- **WHEN** users interact with page components
- **THEN** all existing functionality remains intact
- **AND** only branding and descriptions are updated
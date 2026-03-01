# Changelog

## [Unreleased]

### Added
- Relay Agent feature: Control Minecraft servers through a single HTTP(S) port
  - HTTP/S relay agent with API key authentication
  - TLS/SSL support for secure communication
  - WebSocket support for real-time operations
  - Multi-platform service installation (Windows, Linux, macOS)
  - Docker support for containerized deployment
  - Detailed documentation for setup and configuration
- UI toggle in Settings panel to enable/disable agent relay
- Agent URL, API key, and TLS configuration options
- Client-per-connection isolation for multi-user support
- Graceful error handling and resource cleanup

### Changed
- Restructured preload.js to support transparent agent relay
- Improved error handling in network operations

### Fixed
- Various edge case bugs in network operations

## [1.0.0] - 2023-07-15

### Added
- Initial release of DUITS Minecraft RMM Tool
- RCON protocol support
- Minecraft Query protocol support
- SMB file share operations
- MySQL database access
- Configuration encryption
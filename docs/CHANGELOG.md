# Changelog

All notable changes to NCRelay will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **IP Whitelisting for Custom API Endpoints**: Added endpoint-specific IP address restrictions
  - New `ipWhitelist` field in API endpoint configuration
  - Support for IPv4 and IPv6 addresses
  - Localhost variations handling (127.0.0.1, ::1, localhost)
  - Visual IP management interface in dashboard
  - Comprehensive validation and error handling
  - 403 Forbidden responses for unauthorized IPs
- **Enhanced Documentation**: Updated all documentation to reflect new features
  - New dedicated IP whitelisting guide
  - Updated README with security features
  - Enhanced development documentation
  - Cross-referenced security features in field filter docs

### Changed
- **Database Schema**: Added `ipWhitelist` column to `api_endpoints` table (Migration 008)
- **API Route Security**: Custom endpoint routes now validate client IP against endpoint whitelist
- **Form Validation**: Enhanced endpoint creation/editing forms with IP validation
- **Test Coverage**: Added comprehensive test suite for IP whitelisting functionality

### Technical Details
- Added `isIPAllowedForEndpoint()` utility function with robust IP validation
- Created reusable `IPWhitelistManager` UI component
- Enhanced TypeScript interfaces for type safety
- Updated database operations to handle JSON serialization of IP arrays
- Jest configuration improvements to exclude TypeScript declaration files

### Security
- Custom API endpoints now support IP-based access control
- Backward compatible - existing endpoints remain unrestricted unless explicitly configured
- Unknown IPs are handled securely with proper error responses

### Infrastructure
- **GitHub Actions Workflow**: Updated Docker image build and publishing workflow
  - Support for `dev`, `release/*`, and `hotfix/*` branches
  - Streamlined Docker image tagging strategy
  - Clean versioning for Docker images based on semantic versioning
  - Automatic version extraction from package.json
  - Comprehensive documentation updates for deployment and versioning

## [Previous Releases]

### Field Filters System
- Replaced Grok patterns with visual field selection
- XML field extraction and filtering
- Reusable filter configurations
- Migration tools for existing Grok patterns

### Core Features
- Custom API endpoint creation and management
- Integration with external services
- N-central XML notification processing
- User authentication and session management
- Dashboard interface for configuration

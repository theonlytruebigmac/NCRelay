# Documentation Style Guide

This guide defines the naming and formatting standards for NCRelay documentation.

## File Naming Conventions

### Root-Level Files
**Format**: `UPPERCASE.md`

Files in the root `/docs` directory use uppercase with hyphens:
- `README.md` - Main documentation index
- `CHANGELOG.md` - Version history
- `PROJECT_SUMMARY.md` - High-level overview
- `VERIFICATION.md` - Documentation accuracy audit
- `STYLE-GUIDE.md` - This file

### Subdirectory Files
**Format**: `lowercase-with-dashes.md`

All files within subdirectories use lowercase with hyphens for better readability:

#### `/Documentation` - Operational Guides
- `deployment-guide.md`
- `development-guide.md`
- `docker-overview.md`
- `docker-troubleshooting-guide.md`
- `data-management-guide.md`
- `versioning-guide.md`
- `ghcr-setup-guide.md`

#### `/Features` - Implemented Features
- `field-filters.md`
- `ip-whitelisting.md`
- `enhanced-message-formatting.md`
- `notification-preferences-guide.md`
- `migrating-to-field-filters.md`
- `feature-summary.md`

#### `/Future` - Planned Features
- `recommendations.md`
- `implementation-roadmap.md`
- `feature-implementation-guide.md`
- `monitoring-analytics-guide.md`
- `performance-alerting-guide.md`
- `public-features-guide.md`
- `ui-enhancements-guide.md`

## File Naming Patterns

### Guides
**Suffix**: `-guide.md`

Use for step-by-step instructions or comprehensive how-to documentation:
- `deployment-guide.md`
- `development-guide.md`
- `docker-troubleshooting-guide.md`
- `notification-preferences-guide.md`

### Summaries
**Suffix**: `-summary.md` or `summary.md`

Use for overview documents:
- `feature-summary.md`
- `PROJECT_SUMMARY.md`

### Overviews
**Suffix**: `-overview.md` or `overview.md`

Use for architectural or conceptual documentation:
- `docker-overview.md`

### Roadmaps
**Suffix**: `-roadmap.md` or `roadmap.md`

Use for planning documents:
- `implementation-roadmap.md`

### Feature-Specific Docs
**Format**: `feature-name.md`

Use descriptive feature names without suffixes:
- `field-filters.md`
- `ip-whitelisting.md`
- `enhanced-message-formatting.md`

## Document Structure

### Standard Header Format

```markdown
# Document Title

Brief description of what this document covers.

## Table of Contents (optional for long docs)

- [Section 1](#section-1)
- [Section 2](#section-2)

## Introduction

Context and purpose...
```

### Section Formatting

Use consistent heading levels:
- `#` - Document title (once per file)
- `##` - Major sections
- `###` - Subsections
- `####` - Detail sections (use sparingly)

### Code Blocks

Always specify language for syntax highlighting:

````markdown
```typescript
// TypeScript code
```

```bash
# Shell commands
```

```json
{
  "config": "example"
}
```
````

### Lists

**Unordered lists**: Use `-` for consistency
```markdown
- Item one
- Item two
  - Nested item
```

**Ordered lists**: Use `1.` for all items (auto-numbering)
```markdown
1. First step
1. Second step
1. Third step
```

### Status Indicators

Use emojis consistently:
- ✅ - Implemented/Complete
- 🔄 - In Progress
- ⏳ - Planned
- ❌ - Not Implemented/Deprecated
- 🚀 - Quick Start/Getting Started
- 📋 - Requirements/Prerequisites
- 🔍 - Important Note/Review
- ⚠️ - Warning/Caution
- 💡 - Tip/Best Practice

### Links

**Internal links**: Use relative paths
```markdown
See [deployment guide](Documentation/deployment-guide.md)
See [feature summary](Features/feature-summary.md)
```

**External links**: Include full URL
```markdown
[Docker Documentation](https://docs.docker.com/)
```

### Tables

Use tables for structured data:

```markdown
| Feature | Status | Version |
|---------|--------|---------|
| Field Filters | ✅ Complete | 1.0.0 |
| API Keys | ⏳ Planned | 2.0.0 |
```

## Content Guidelines

### Writing Style

1. **Be concise** - Get to the point quickly
2. **Use active voice** - "Run the command" not "The command should be run"
3. **Be specific** - Provide exact commands, file paths, and examples
4. **Update dates** - Include dates for time-sensitive information

### Code Examples

1. **Always test** - Ensure all code examples work
2. **Show output** - Include expected results when helpful
3. **Explain complex code** - Add comments for clarity
4. **Use realistic examples** - Base examples on actual use cases

### Documentation Maintenance

1. **Update on changes** - Keep docs in sync with code
2. **Remove obsolete content** - Don't leave outdated information
3. **Cross-reference** - Link to related documentation
4. **Version appropriately** - Note which version features were added

## Checklist for New Documentation

- [ ] File name follows convention (lowercase-with-dashes.md)
- [ ] Placed in correct directory (/Documentation, /Features, or /Future)
- [ ] Includes clear title and description
- [ ] Has proper heading hierarchy
- [ ] Code blocks specify language
- [ ] Links use relative paths
- [ ] Status indicators are consistent
- [ ] Added to README.md index
- [ ] Reviewed for accuracy
- [ ] Date added to content if time-sensitive

## Examples

### Good File Names ✅
- `deployment-guide.md`
- `field-filters.md`
- `docker-troubleshooting-guide.md`
- `feature-summary.md`

### Poor File Names ❌
- `DEPLOYMENT-GUIDE.md` (subdirectory file in uppercase)
- `Field_Filters.md` (underscores, mixed case)
- `docker_guide.MD` (underscores, uppercase extension)
- `guide-deployment.md` (suffix should be at end)

### Good Section Structure ✅

```markdown
## Prerequisites

Before you begin, ensure you have:

- Node.js 20.x or higher
- Docker 24.x or higher
- Git installed

## Installation

1. Clone the repository
1. Install dependencies
1. Configure environment

## Configuration

Edit the `.env` file:

\`\`\`bash
DATABASE_URL=...
\`\`\`
```

### Poor Section Structure ❌

```markdown
Prerequisites

You need some stuff installed first...

Installation
Just run some commands...

Configuration
Set some variables
```

## Questions?

When in doubt:
1. Check existing documentation for examples
2. Follow the patterns in this guide
3. Prioritize clarity and consistency

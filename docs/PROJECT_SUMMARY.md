# NCRelay - Project Overview

> **📚 Full Documentation**: See [docs/README.md](README.md) for complete documentation structure

NCRelay is a secure, self-hosted notification relay platform that receives webhooks from N-central RMM and intelligently routes them to various platforms (Slack, Discord, Teams, Email) with powerful filtering, transformation, and security features.

## 🎯 Core Purpose

Transform complex RMM notifications into actionable, well-formatted messages delivered to the right teams at the right time, with enterprise-grade security and reliability.

## ✅ Key Features (Implemented)

### Security & Access Control
- **IP Whitelisting** - Endpoint-specific IP restrictions
- **JWT Authentication** - Secure user authentication
- **User Management** - Admin and user roles
- **Encrypted Credentials** - AES-256 encryption for sensitive data

### Notification Processing
- **Field Filters** - Extract and transform notification data
- **Enhanced Formatting** - Rich, color-coded messages for all platforms  
- **Notification Queue** - Reliable delivery with automatic retries
- **Request Logging** - Comprehensive audit trail

### User Experience
- **Custom API Endpoints** - Create and manage webhook receivers
- **Notification Preferences** - Per-user notification settings
- **Digest Emails** - Batched notification summaries
- **Queue Management** - Monitor and manage pending notifications
## 🏗️ Architecture

- **Frontend**: Next.js 16 with React, TailwindCSS, shadcn/ui
- **Backend**: Node.js with TypeScript, ES modules
- **Database**: SQLite with Better-SQLite3
- **Authentication**: JWT with bcrypt password hashing
- **Deployment**: Docker with multi-stage builds

## 📦 Platform Support

- ✅ **Slack** - Rich formatting with blocks and attachments
- ✅ **Discord** - Embeds with colors and fields
- ✅ **Microsoft Teams** - Adaptive cards
- ✅ **Email** - HTML and text formats with nodemailer

## 🚀 Getting Started

### Quick Links
- **Development Setup**: [Documentation/DEVELOPMENT.md](Documentation/DEVELOPMENT.md)
- **Production Deployment**: [Documentation/DEPLOYMENT.md](Documentation/DEPLOYMENT.md)
- **Docker Guide**: [Documentation/DOCKER-OVERVIEW.md](Documentation/DOCKER-OVERVIEW.md)
- **Feature Documentation**: [Features/](Features/)

### Prerequisites
- Node.js 20.x
- Docker & Docker Compose (for containerized deployment)
- SMTP server (for email notifications)

## 📊 Current Status

# NCRelay

**Securely relay notifications to your favorite platforms.**

NCRelay is a powerful notification relay service that receives XML data via custom API endpoints and forwards it to various messaging platforms like Slack, Discord, Microsoft Teams, and generic webhooks. Built with Next.js 15 and SQLite, it provides a secure, self-hosted solution for managing notification workflows.

## 🚀 Features

- **Custom API Endpoints**: Create custom API paths to receive XML notifications
- **Multi-Platform Support**: Integrate with Slack, Discord, Microsoft Teams, and generic webhooks
- **Flexible Data Transformation**: Convert XML to JSON, plain text, or keep as XML
- **Secure Authentication**: User management with bcrypt password hashing
- **Comprehensive Logging**: Track all requests and relay attempts with detailed logs
- **Intuitive Dashboard**: Clean, modern UI for managing integrations and monitoring
- **SMTP Configuration**: Email notifications and password reset functionality
- **Data Encryption**: Sensitive data like webhook URLs are encrypted at rest
- **Self-Hosted**: Full control over your data and infrastructure

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- SQLite (included with better-sqlite3)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ncrelay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   NODE_ENV=development

   # Initial Admin User (required for first setup)
   INITIAL_ADMIN_EMAIL=admin@example.com
   INITIAL_ADMIN_PASSWORD=your-secure-password
   INITIAL_ADMIN_NAME=Admin User

   # Encryption Key (generate a secure 32-character key)
   ENCRYPTION_KEY=your-32-character-encryption-key

   # Optional: Custom port
   PORT=9005
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open [http://localhost:9005](http://localhost:9005) in your browser

## 🔧 Configuration

### Initial Setup

1. **Login**: Use the credentials from your `.env.local` file to log in
2. **Add Integrations**: Go to Integrations and add your messaging platforms
3. **Create API Endpoints**: Configure custom API endpoints and link them to integrations
4. **Test**: Send XML data to your custom endpoints

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `INITIAL_ADMIN_EMAIL` | Admin user email for first setup | Yes |
| `INITIAL_ADMIN_PASSWORD` | Admin user password (change after setup) | Yes |
| `INITIAL_ADMIN_NAME` | Admin user display name | No |
| `ENCRYPTION_KEY` | 32-character key for data encryption | Yes |

### Database

NCRelay uses SQLite with better-sqlite3:
- **Development**: `app.db` in project root
- **Production**: `/data/app.db`

The database schema is automatically initialized on first run.

## 🎯 Usage

### Creating Integrations

1. Navigate to **Dashboard → Integrations**
2. Click **Add Integration**
3. Configure your platform:
   - **Name**: Descriptive name for the integration
   - **Platform**: Choose from Slack, Discord, Teams, or Generic Webhook
   - **Webhook URL**: The destination URL for notifications
   - **Target Format**: How to transform XML data (JSON, Text, or XML)

### Setting up API Endpoints

1. Go to **Dashboard → API Endpoints**
2. Click **Add API Endpoint**
3. Configure:
   - **Name**: Descriptive name
   - **Path**: Custom path (e.g., "alerts", "notifications")
   - **Associated Integrations**: Select which integrations to trigger

### Sending Notifications

Send XML data to your custom endpoint:

```bash
curl -X POST \
  http://localhost:9005/api/custom/your-endpoint-path \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
      <notification>
        <title>Alert Title</title>
        <message>Your notification message here</message>
        <severity>high</severity>
      </notification>'
```

### Platform-Specific Examples

#### Slack Integration
- **Webhook URL**: Your Slack webhook URL
- **Target Format**: Text or JSON
- **Text Output**: Extracts readable text from XML
- **JSON Output**: Full XML converted to JSON

#### Discord Integration
- **Webhook URL**: Your Discord webhook URL  
- **Target Format**: Text (recommended)
- **Output**: Formatted as Discord message content

#### Microsoft Teams
- **Webhook URL**: Your Teams connector webhook
- **Target Format**: Text or JSON
- **Output**: Formatted for Teams cards or simple text

## 📊 Monitoring

### Dashboard
The main dashboard provides:
- Active integrations count
- Total requests logged
- Quick access to all features

### Logs
View detailed logs of all API requests:
- Request details (IP, headers, payload)
- Processing status
- Integration attempt results
- Error details and responses

### Request Lifecycle
1. **Receive**: XML data via custom API endpoint
2. **Validate**: Check content type and payload
3. **Transform**: Convert XML based on integration settings
4. **Relay**: Send to configured webhook URLs
5. **Log**: Record all details for monitoring

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **Data Encryption**: Sensitive data encrypted at rest
- **Session Management**: Secure authentication system
- **Input Validation**: XML parsing and validation
- **Error Handling**: Detailed logging without exposing internals

## 🏗️ Development

### Project Structure
```
src/
├── app/                    # Next.js app directory
│   ├── (app)/             # Authenticated routes
│   ├── api/               # API routes
│   └── page.tsx           # Root page
├── components/            # React components
├── context/               # React contexts
├── lib/                   # Utilities and database
└── config/                # Configuration files
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with Turbopack on port 9005

# Production
npm run build        # Build for production
npm start           # Start production server

# Quality
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript checks
```

### Database Schema

#### Tables
- **users**: User accounts and authentication
- **integrations**: Messaging platform configurations
- **api_endpoints**: Custom API endpoint definitions
- **request_logs**: API request and processing logs
- **smtp_settings**: Email configuration
- **password_reset_tokens**: Password reset functionality

## 🚀 Deployment

### Docker (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup
- Ensure `/data` directory exists for production database
- Set strong `ENCRYPTION_KEY` and admin credentials
- Configure reverse proxy if needed

### Database Persistence
- Development: Database file in project directory
- Production: Mount `/data` volume for persistence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the logs in the Dashboard for troubleshooting
- Review the API endpoint configuration
- Verify webhook URLs are accessible
- Ensure XML payload format is valid

## 🔄 API Reference

### Custom Endpoints

**POST** `/api/custom/{endpointName}`
- **Content-Type**: `application/xml` or `text/xml`
- **Body**: Valid XML payload
- **Response**: Processing summary with integration results

**GET** `/api/custom/{endpointName}`
- **Response**: Endpoint information and status

### Legacy Endpoint (Deprecated)
- `/api/notify` returns 410 Gone status
- Use custom endpoints instead

---

**NCRelay** - Secure, reliable notification relay service

# ms-365-mcp-server

![npm version](https://img.shields.io/npm/v/@softeria/ms-365-mcp-server.svg) ![build status](https://github.com/softeria/ms-365-mcp-server/actions/workflows/build.yml/badge.svg) ![license](https://img.shields.io/badge/license-MIT-blue.svg)

Microsoft 365 MCP Server

A Model Context Protocol (MCP) server for interacting with Microsoft 365 services through the Graph API.

## Prerequisites

- Node.js >= 14

## Features

- Authentication via Microsoft Authentication Library (MSAL)
- Excel file operations
- Calendar event management
- Mail operations
- OneDrive file management
- OneNote notebooks and pages
- To Do tasks and task lists
- Planner plans and tasks
- Outlook contacts
- User management
- Dynamic tools powered by Microsoft Graph OpenAPI spec
- Built on the Model Context Protocol

## Quick Start Example

Test login in Claude Desktop:

![Login example](https://github.com/user-attachments/assets/e457884f-c98a-4186-9e6f-eb323ec24e0a)

## Examples

![Image](https://github.com/user-attachments/assets/1a296afb-48ed-42b0-9e7c-e685d5d1784c)

## Integration

### Claude Desktop

To add this MCP server to Claude Desktop:

Edit the config file under Settings > Developer:

```json
{
  "mcpServers": {
    "ms365": {
      "command": "npx",
      "args": [
        "-y",
        "@softeria/ms-365-mcp-server"
      ]
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add ms365 -- npx -y @softeria/ms-365-mcp-server
```

For other interfaces that support MCPs, please refer to their respective documentation for the correct
integration method.

### Authentication

> ⚠️ You must authenticate before using tools.

1. **MCP client login**:
    - Call the `login` tool (auto-checks existing token)
    - If needed, get URL+code, visit in browser
    - Use `verify-login` tool to confirm
2. **Optional CLI login**:
   ```bash
   npx @softeria/ms-365-mcp-server --login
   ```
   Follow the URL and code prompt in the terminal.

Tokens are cached securely in your OS credential store (fallback to file).

## License

MIT © 2025 Softeria

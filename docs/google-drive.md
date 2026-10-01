# Google Drive Integration (Block 7)

## Overview
The NEXUS AI Google Drive integration provides an app-managed workspace within the user's Google Drive. Instead of requesting broad access to a user's entire Drive, NEXUS operates entirely within the scope of files it creates (`drive.file` scope).

## Architecture
- **googleDriveService.js**: Provides standard primitives for creating folders, listing files, and reading content through the `googleapis` library.
- **googleDriveTools.js**: Exposes these primitives as strictly typed AI tools registered in the `toolRegistry`.
- **Google Connections Metadata**: The ID of the root `NEXUS AI` folder is stored in `google_connections.metadata.nexus_workspace_id`.
- **External Actions**: Every write operation (folder creation, document creation) is logged to `external_actions` for audit and idempotency.

## OAuth Scope Limitation
NEXUS uses:
`https://www.googleapis.com/auth/drive.file`

**Important Note on Search**:
Because we use `drive.file`, the agent can only see and search for files that the application itself created. When the agent is asked to "Search my Drive", it will specifically search only the files that NEXUS has access to (the connected NEXUS workspace). 
This provides a strong security boundary, preventing arbitrary AI access to a user's personal or company files.

## NEXUS Workspace Structure
When a user initializes their workspace, NEXUS creates a predictable folder hierarchy:
```
NEXUS AI/
├── Policies/
├── Reports/
├── Expenses/
├── Onboarding/
└── Meeting Reports/
```

## AI Tools
1. `search_drive`: Uses Google's `q` syntax (safely escaped on the backend) to query files within the workspace. Risk: `read_only`.
2. `get_drive_file`: Fetches metadata and exports Google Docs to plaintext for agent ingestion. Includes protections against massive files. Risk: `read_only`.
3. `create_drive_folder`: Creates folders. Also powers the workspace initialization. Risk: `external_write`.
4. `create_drive_document`: Creates a native Google Document from plaintext content. Risk: `external_write`.

## Idempotency
- The root NEXUS workspace creation handles idempotency by checking `google_connections` first, then querying Google Drive directly, before creating it.
- `create_drive_folder` and `create_drive_document` record an `idempotency_key` in the `external_actions` table.

## Testing
A comprehensive test script exists in `backend/scripts/verify-block7.js` that performs:
1. Workspace initialization
2. Subfolder verification
3. Document creation
4. Content retrieval
5. Tool execution verification
6. User isolation and unauthorized access testing

## Future Extension Points
- **Import File Flow**: Since NEXUS only sees files it creates, importing pre-existing company policies (like an existing Expense Policy) will require an explicit frontend flow where the user picks a file to grant NEXUS access, which will then persist its ID to the database.

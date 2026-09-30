# AI Tool Contract

## API Endpoint

`POST /api/ai/agent`

## Agent Loop

1. **User** sends request
2. Backend gathers **context**
3. Backend sends request + context to **Gemini**
4. Gemini proposes a **tool call**
5. Backend performs **validation** on inputs
6. Backend performs **authorization** (Role checking)
7. Backend executes the **tool execution**
8. Backend generates an **audit** log of the action
9. Backend sends the **tool result** back to Gemini
10. Gemini formulates the **final response** to the User

## Tool Categories

- `read_only`
- `internal_write`
- `external_write`
- `sensitive_external_write`

## ToolDefinition Contract

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any; // Zod or JSON schema
  requiredPermission: string;
  riskLevel: 'read_only' | 'internal_write' | 'external_write' | 'sensitive_external_write';
  execute: (args: any, context: any) => Promise<any>;
}
```

## Security Restrictions

- Gemini **CANNOT** access raw SQL.
- Gemini **CANNOT** access arbitrary URLs.
- Gemini **CANNOT** bypass the backend's validation and authorization checks.

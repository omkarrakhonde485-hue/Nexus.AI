import {
  searchFiles,
  getFileMetadata,
  readFile,
  createFolder,
  createDocument,
  ensureNexusWorkspace
} from '../integrations/google/googleDriveService.js';
import { supabaseAdmin } from '../config/supabase.js';
import { TOOL_RISK_LEVELS } from './toolConstants.js';

// Helper to log to activity_logs
async function logDriveAction(userId, actorType, action, tool, externalId, status) {
  try {
    const { error } = await supabaseAdmin.from('activity_logs').insert({
      actor_id: userId,
      actor_type: actorType || 'ai',
      action: action,
      description: `Google Drive: ${action} via ${tool}`,
      metadata: { tool, external_id: externalId, status }
    });
    if (error) {
      console.error('Failed to log drive action to activity_logs:', error.message);
    }
  } catch (err) {
    console.error('Failed to log drive action:', err.message);
  }
}

// Helper to record external action
async function recordExternalAction({ userId, actionType, idempotencyKey, externalId, status, requestMetadata }) {
  try {
    await supabaseAdmin.from('external_actions').insert({
      user_id: userId,
      provider: 'google',
      action_type: actionType,
      idempotency_key: idempotencyKey,
      external_id: externalId,
      status: status,
      request_metadata: requestMetadata || {}
    });
  } catch (err) {
    if (err.code !== '23505') { // Ignore unique violation on idempotency key
      console.error('Failed to record external action:', err);
    }
  }
}

export const googleDriveTools = {
  search_drive: {
    name: 'search_drive',
    description: 'Search for files in the connected NEXUS Google Drive workspace.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: 'google.drive.read',
    declaration: {
      name: 'search_drive',
      description: 'Search for files in the connected NEXUS Google Drive workspace.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'The search query (e.g. "expense policy").' },
          parentFolderId: { type: 'STRING', description: 'Optional ID of a parent folder to restrict the search.' },
          mimeType: { type: 'STRING', description: 'Optional MIME type to filter by.' },
          limit: { type: 'INTEGER', description: 'Maximum number of results to return (default 10, max 20).' }
        },
        required: ['query']
      }
    },
    execute: async (args, context) => {
      const { query, parentFolderId, mimeType, limit } = args;
      const { user } = context;

      try {
        const files = await searchFiles(user.id, { query, parentFolderId, mimeType, limit });
        
        if (context.isAi) {
          await logDriveAction(user.id, 'ai', 'ai_called_tool', 'search_drive', null, 'success');
        }

        return { success: true, files };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  get_drive_file: {
    name: 'get_drive_file',
    description: 'Retrieves metadata and content for a specific file in the NEXUS Google Drive workspace.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: 'google.drive.read',
    declaration: {
      name: 'get_drive_file',
      description: 'Retrieves metadata and content for a specific file in the NEXUS Google Drive workspace.',
      parameters: {
        type: 'OBJECT',
        properties: {
          fileId: { type: 'STRING', description: 'The Google Drive file ID.' }
        },
        required: ['fileId']
      }
    },
    execute: async (args, context) => {
      const { fileId } = args;
      const { user } = context;

      try {
        const result = await readFile(user.id, fileId);
        
        const MAX_CONTENT_LENGTH = 20000;
        let content = result.content;
        let content_truncated = false;
        
        if (typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
          content = content.substring(0, MAX_CONTENT_LENGTH) + '\\n\\n...[TRUNCATED]...';
          content_truncated = true;
        }

        if (context.isAi) {
          await logDriveAction(user.id, 'ai', 'ai_called_tool', 'get_drive_file', fileId, 'success');
        }

        return {
          success: true,
          file: { ...result.metadata, content },
          content_truncated
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  create_drive_folder: {
    name: 'create_drive_folder',
    description: 'Create a new folder in Google Drive or initialize the NEXUS AI workspace by requesting name="NEXUS AI".',
    riskLevel: TOOL_RISK_LEVELS.EXTERNAL_WRITE,
    requiredPermission: 'google.drive.write',
    declaration: {
      name: 'create_drive_folder',
      description: 'Create a new folder in Google Drive. Can also be used to initialize the NEXUS AI workspace by requesting name="NEXUS AI".',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Name of the folder.' },
          parentFolderId: { type: 'STRING', description: 'Optional ID of the parent folder.' }
        },
        required: ['name']
      }
    },
    execute: async (args, context) => {
      const { name, parentFolderId } = args;
      const { user } = context;

      try {
        let result;
        if (name.toLowerCase() === 'nexus ai' && !parentFolderId) {
          result = await ensureNexusWorkspace(user.id);
        } else {
          result = await createFolder(user.id, name, parentFolderId);
        }

        await recordExternalAction({
          userId: user.id,
          actionType: 'drive.create_folder',
          idempotencyKey: `google:${user.id}:create_folder:${result.folderId || Date.now()}`,
          externalId: result.folderId,
          status: 'success',
          requestMetadata: { name, parentFolderId }
        });

        if (context.isAi) {
          await logDriveAction(user.id, 'ai', 'drive_folder_created', 'create_drive_folder', result.folderId, 'success');
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  create_drive_document: {
    name: 'create_drive_document',
    description: 'Create a new Google Document with text content.',
    riskLevel: TOOL_RISK_LEVELS.EXTERNAL_WRITE,
    requiredPermission: 'google.drive.write',
    declaration: {
      name: 'create_drive_document',
      description: 'Create a new Google Document with text content.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Name of the document.' },
          content: { type: 'STRING', description: 'Text content of the document.' },
          folderId: { type: 'STRING', description: 'ID of the folder where the document should be created.' }
        },
        required: ['name', 'content']
      }
    },
    execute: async (args, context) => {
      const { name, content, folderId } = args;
      const { user } = context;

      try {
        const result = await createDocument(user.id, name, content, folderId);

        await recordExternalAction({
          userId: user.id,
          actionType: 'drive.create_document',
          idempotencyKey: `google:${user.id}:create_doc:${result.id}`,
          externalId: result.id,
          status: 'success',
          requestMetadata: { name, folderId }
        });

        if (context.isAi) {
          await logDriveAction(user.id, 'ai', 'drive_document_created', 'create_drive_document', result.id, 'success');
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
};


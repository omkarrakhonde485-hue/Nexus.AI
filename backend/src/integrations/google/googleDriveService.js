import { google } from 'googleapis';
import { getGoogleClient } from './googleClientFactory.js';
import { supabaseAdmin } from '../../config/supabase.js';

// Get an authenticated Drive client for a user
export async function getDriveClient(userId) {
  const oAuth2Client = await getGoogleClient(userId);
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

// Ensure the NEXUS workspace exists in Drive and return its metadata
export async function ensureNexusWorkspace(userId) {
  const drive = await getDriveClient(userId);
  
  // 1. Check if user already has it in google_connections metadata
  const { data: connection, error: connErr } = await supabaseAdmin
    .from('google_connections')
    .select('metadata')
    .eq('user_id', userId)
    .single();

  if (connErr && connErr.code !== 'PGRST116') {
    throw new Error(`Failed to fetch connection metadata: ${connErr.message}`);
  }

  const metadata = connection?.metadata || {};
  let nexusFolderId = metadata.nexus_workspace_id;

  // 2. If we don't have it saved, try to find an existing "NEXUS AI" folder
  if (!nexusFolderId) {
    const q = "name='NEXUS AI' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const res = await drive.files.list({
      q,
      spaces: 'drive',
      fields: 'files(id, name, webViewLink)'
    });
    
    if (res.data.files && res.data.files.length > 0) {
      nexusFolderId = res.data.files[0].id;
    } else {
      // 3. Create it if missing
      const createRes = await drive.files.create({
        requestBody: {
          name: 'NEXUS AI',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id, name, webViewLink'
      });
      nexusFolderId = createRes.data.id;
    }

    // Save to metadata
    metadata.nexus_workspace_id = nexusFolderId;
    await supabaseAdmin
      .from('google_connections')
      .update({ metadata })
      .eq('user_id', userId);
  }

  // Now ensure subfolders exist
  const subfolders = ['Policies', 'Reports', 'Expenses', 'Onboarding', 'Meeting Reports'];
  
  // Find existing subfolders
  const subQ = `'${nexusFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const subRes = await drive.files.list({
    q: subQ,
    spaces: 'drive',
    fields: 'files(id, name)'
  });
  
  const existingNames = new Set((subRes.data.files || []).map(f => f.name));
  
  // Create missing subfolders
  for (const name of subfolders) {
    if (!existingNames.has(name)) {
      await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [nexusFolderId]
        },
        fields: 'id, name'
      });
    }
  }

  // Get full metadata for the workspace folder to return
  const wsRes = await drive.files.get({
    fileId: nexusFolderId,
    fields: 'id, name, webViewLink'
  });

  return {
    success: true,
    folderId: wsRes.data.id,
    name: wsRes.data.name,
    webViewLink: wsRes.data.webViewLink
  };
}

// List files with options
export async function listFiles(userId, options = {}) {
  const drive = await getDriveClient(userId);
  const limit = Math.min(options.limit || 10, 20);
  
  const res = await drive.files.list({
    pageSize: limit,
    q: options.q || '',
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink, parents)'
  });
  
  return res.data.files || [];
}

// Build a safe query for Google Drive
function buildDriveSearchQuery({ query, parentFolderId, mimeType }) {
  const parts = [];
  
  // Basic escaping for single quotes in text search
  if (query) {
    const escapedText = query.replace(/'/g, "\\'");
    parts.push(`fullText contains '${escapedText}'`);
  }
  
  if (parentFolderId) {
    const escapedParent = parentFolderId.replace(/'/g, "\\'");
    parts.push(`'${escapedParent}' in parents`);
  }
  
  if (mimeType) {
    const escapedMime = mimeType.replace(/'/g, "\\'");
    parts.push(`mimeType = '${escapedMime}'`);
  }
  
  parts.push(`trashed = false`);
  
  return parts.join(' and ');
}

// Search files safely
export async function searchFiles(userId, { query, parentFolderId, mimeType, limit }) {
  const safeQ = buildDriveSearchQuery({ query, parentFolderId, mimeType });
  return listFiles(userId, { q: safeQ, limit });
}

// Get file metadata
export async function getFileMetadata(userId, fileId) {
  const drive = await getDriveClient(userId);
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, modifiedTime, webViewLink, parents'
  });
  return res.data;
}

// Read file content
export async function readFile(userId, fileId) {
  const drive = await getDriveClient(userId);
  
  // First get metadata
  const metadata = await getFileMetadata(userId, fileId);
  
  if (metadata.mimeType === 'application/vnd.google-apps.document') {
    // For Google Docs, we need to export it as text
    try {
      const res = await drive.files.export({
        fileId,
        mimeType: 'text/plain'
      });
      return {
        metadata,
        content: res.data
      };
    } catch (err) {
      if (err.message && err.message.includes('fileNotExportable')) {
        throw new Error('Cannot export this file type.');
      }
      throw err;
    }
  } else {
    // Other file types might need .get with alt=media
    try {
      const res = await drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'text' });
      return {
        metadata,
        content: res.data
      };
    } catch (err) {
      throw new Error(`Failed to read file content: ${err.message}`);
    }
  }
}

// Create a folder
export async function createFolder(userId, name, parentId = null) {
  const drive = await getDriveClient(userId);
  const requestBody = {
    name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  
  if (parentId) {
    requestBody.parents = [parentId];
  }
  
  const res = await drive.files.create({
    requestBody,
    fields: 'id, name, webViewLink'
  });
  
  return {
    success: true,
    folderId: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink
  };
}

// Create a document
export async function createDocument(userId, name, content, parentId = null) {
  const drive = await getDriveClient(userId);
  const requestBody = {
    name,
    mimeType: 'application/vnd.google-apps.document'
  };
  
  if (parentId) {
    requestBody.parents = [parentId];
  }
  
  const media = {
    mimeType: 'text/plain',
    body: content
  };
  
  const res = await drive.files.create({
    requestBody,
    media,
    fields: 'id, name, webViewLink, mimeType'
  });
  
  return {
    success: true,
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink,
    mimeType: res.data.mimeType
  };
}

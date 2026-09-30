import { Router } from 'express';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const router = Router();

// GET /api/health
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'nexus-backend',
      environment: env.NODE_ENV
    }
  });
});

// GET /api/health/database
router.get('/database', async (req, res) => {
  try {
    if (!env.SUPABASE_URL || env.SUPABASE_URL.includes('placeholder')) {
      return res.status(200).json({
        success: true,
        data: {
          database: 'placeholder_mode',
          message: 'Supabase configured with placeholder credentials for Block 1'
        }
      });
    }

    const { error } = await supabase.from('_dummy_ping').select('count').limit(1);
    if (error && error.code !== 'PGRST204' && error.code !== '42P01') {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        database: 'connected'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection is unavailable.'
      }
    });
  }
});

// GET /api/health/ai
router.get('/ai', (req, res) => {
  const isConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '');
  res.status(200).json({
    success: true,
    data: {
      provider: 'google-gemini',
      configured: isConfigured
    }
  });
});

export default router;

import { Router } from 'express';
import { pool } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { CreateProjectSchema, UpdateProjectSchema } from 'shared/project.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all projects for user
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const { page = '1', pageSize = '10', status } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    let query = 'SELECT * FROM projects WHERE user_id = $1';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(pageSize as string), offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = status
      ? 'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = $2'
      : 'SELECT COUNT(*) FROM projects WHERE user_id = $1';
    const countParams = status ? [userId, status] : [userId];
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        items: result.rows,
        total,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        totalPages: Math.ceil(total / parseInt(pageSize as string)),
      },
    });
  })
);

// Get single project
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  })
);

// Create project
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const data = CreateProjectSchema.parse({
      ...req.body,
      userId,
    });

    const result = await pool.query(
      `INSERT INTO projects (user_id, title, artist, audio_url, album_art_url, duration_seconds, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        data.title,
        data.artist,
        data.audioUrl,
        data.albumArtUrl || null,
        data.durationSeconds,
        JSON.stringify(data.config),
        data.status,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  })
);

// Update project
router.patch(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const existing = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);

    if (existing.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    const data = UpdateProjectSchema.parse({ ...req.body, id });

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.title) {
      updates.push(`title = $${paramCount++}`);
      values.push(data.title);
    }
    if (data.artist) {
      updates.push(`artist = $${paramCount++}`);
      values.push(data.artist);
    }
    if (data.config) {
      updates.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(data.config));
    }
    if (data.status) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.albumArtUrl !== undefined) {
      updates.push(`album_art_url = $${paramCount++}`);
      values.push(data.albumArtUrl);
    }

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    values.push(id);
    const query = `UPDATE projects SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows[0],
    });
  })
);

// Delete project
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id', [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  })
);

export default router;

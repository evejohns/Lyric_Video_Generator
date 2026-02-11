import { Worker, Job } from 'bullmq';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { pool } from '../config/database.js';
import redis from '../config/redis.js';
import { s3Client, bucketName, bucketUrl } from '../config/storage.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RenderJobData {
  exportId: string;
  projectId: string;
  project: {
    id: string;
    title: string;
    artist: string;
    audio_url: string;
    album_art_url: string | null;
    duration_seconds: number;
    config: any;
  };
  lyrics: Array<{
    id: string;
    text: string;
    start_time: number | null;
    end_time: number | null;
  }>;
  resolution: string;
  format: string;
  userId: string;
}

// Resolution mapping
const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

// Create temp directory for renders
const TEMP_DIR = path.join(__dirname, '../../temp');

async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create temp directory:', error);
  }
}

async function updateExportStatus(
  exportId: string,
  status: string,
  progress?: number,
  error?: string,
  fileUrl?: string,
  fileSizeMb?: number
) {
  const updates: string[] = ['status = $2'];
  const values: any[] = [exportId, status];
  let paramIndex = 3;

  if (progress !== undefined) {
    updates.push(`progress = $${paramIndex++}`);
    values.push(progress);
  }

  if (error !== undefined) {
    updates.push(`error = $${paramIndex++}`);
    values.push(error);
  }

  if (fileUrl !== undefined) {
    updates.push(`file_url = $${paramIndex++}`);
    values.push(fileUrl);
  }

  if (fileSizeMb !== undefined) {
    updates.push(`file_size_mb = $${paramIndex++}`);
    values.push(fileSizeMb);
  }

  if (status === 'completed') {
    updates.push(`completed_at = NOW()`);
  }

  const query = `UPDATE exports SET ${updates.join(', ')} WHERE id = $1`;
  await pool.query(query, values);
}

async function renderVideo(job: Job<RenderJobData>): Promise<void> {
  const { exportId, project, lyrics, resolution, format } = job.data;

  console.log(`[Worker] Starting Remotion render for export ${exportId}`);

  await updateExportStatus(exportId, 'processing', 0);

  const dimensions = RESOLUTION_MAP[resolution] || RESOLUTION_MAP['1080p'];
  const outputFilename = `${exportId}.${format}`;
  const outputPath = path.join(TEMP_DIR, outputFilename);

  try {
    // For Remotion, use the original audio URL directly
    // Remotion can handle downloading from URLs during render
    const audioUrl = project.audio_url;
    console.log(`[Worker] Using audio URL: ${audioUrl}`);

    // Get template/background config
    const config = project.config || {};

    await updateExportStatus(exportId, 'processing', 10);

    console.log(`[Worker] Rendering with ${lyrics.length} lyrics`);
    console.log(`[Worker] Duration: ${project.duration_seconds}s`);

    // Bundle the Remotion project
    console.log('[Worker] Bundling Remotion project...');
    // Point to source directory (src/remotion) not dist directory
    const srcDir = path.resolve(__dirname, '../../src');
    const entryPoint = path.join(srcDir, 'remotion', 'index.ts');
    console.log(`[Worker] Entry point: ${entryPoint}`);

    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    await updateExportStatus(exportId, 'processing', 20);

    // Calculate video parameters
    const fps = 30;
    const durationInFrames = Math.ceil(project.duration_seconds * fps);

    // Get composition with proper props
    const inputProps = {
      lyrics: lyrics.map((l) => ({
        text: l.text,
        start_time: l.start_time || 0,
        end_time: l.end_time || 0,
      })),
      audioUrl: audioUrl,
      template: config.template || {},
      config: config,
      albumArtUrl: project.album_art_url || undefined,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'LyricVideo',
      inputProps,
    });

    console.log('[Worker] Selected composition:', composition.id);
    console.log(`[Worker] Rendering ${durationInFrames} frames at ${fps}fps`);
    await updateExportStatus(exportId, 'processing', 30);

    // Render the video
    console.log('[Worker] Starting video render...');
    await renderMedia({
      composition: {
        ...composition,
        width: dimensions.width,
        height: dimensions.height,
        fps,
        durationInFrames,
      },
      serveUrl: bundleLocation,
      codec: format === 'mov' ? 'prores' : 'h264',
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress }) => {
        const renderProgress = 30 + Math.floor(progress * 60); // 30-90%
        updateExportStatus(exportId, 'processing', renderProgress).catch(console.error);
      },
    });

    console.log('[Worker] Render complete, uploading to S3...');
    await updateExportStatus(exportId, 'processing', 90);

    // Upload to S3
    const fileBuffer = await fs.readFile(outputPath);
    const fileStats = await fs.stat(outputPath);
    const fileSizeMb = fileStats.size / (1024 * 1024);

    const s3Key = `exports/${exportId}/${outputFilename}`;
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: `video/${format}`,
    });

    await s3Client.send(uploadCommand);

    const fileUrl = `${bucketUrl}/${s3Key}`;
    console.log('[Worker] Upload complete:', fileUrl);

    // Clean up temp files
    try {
      await fs.unlink(outputPath);
    } catch (cleanupError) {
      console.error('[Worker] Cleanup error:', cleanupError);
    }

    // Update export status to completed
    await updateExportStatus(exportId, 'completed', 100, undefined, fileUrl, fileSizeMb);

    console.log(`[Worker] Export ${exportId} completed successfully`);
  } catch (error: any) {
    console.error(`[Worker] Render failed for export ${exportId}:`, error);
    await updateExportStatus(exportId, 'failed', undefined, error.message);
    throw error;
  }
}

// Create and start worker
export const exportWorker = new Worker<RenderJobData>(
  'video-render',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} for export ${job.data.exportId}`);
    await renderVideo(job);
  },
  {
    connection: redis,
    concurrency: 2, // Process 2 videos at a time
    limiter: {
      max: 5, // Max 5 jobs
      duration: 60000, // Per minute
    },
  }
);

exportWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

exportWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

exportWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

// Ensure temp directory exists on startup
ensureTempDir();

console.log('[Worker] Export worker started and listening for jobs');

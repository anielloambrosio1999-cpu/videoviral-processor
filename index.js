// index.js - Video processor per Railway in CommonJS (niente Supabase)

const express = require('express');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.post('/process', async (req, res) => {
  console.log('=== New /process call ===');
  try {
    const { job_id, account_id, video_url, preset_key, pipeline } = req.body;
    console.log('job_id:', job_id);
    console.log('account_id:', account_id);
    console.log('video_url:', video_url);
    console.log('preset_key:', preset_key);
    console.log('pipeline:', pipeline);

    if (!video_url) {
      return res.status(400).json({ error: 'video_url is required' });
    }

    // 1) Scarica il video in /tmp
    const safeJobId = job_id || 'job';
    const safePreset = preset_key || 'preset';

    const inputPath = `/tmp/${safeJobId}-${safePreset}-input.mp4`;
    const outputPath = `/tmp/${safeJobId}-${safePreset}-output.mp4`;

    console.log(`Downloading video to: ${inputPath}`);

    const response = await fetch(video_url);
    if (!response.ok) {
      console.error('Error downloading video:', response.status, response.statusText);
      return res.status(400).json({ error: 'Failed to download video' });
    }

    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(inputPath);
      response.body.pipe(fileStream);
      response.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    console.log('Download done');

    // 2) Crop 9:16 + export 1080x1920 con ffmpeg
    console.log('Running ffmpeg crop 9:16…');

    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-vf',
      'crop=in_h*9/16:in_h:(in_w-out_w)/2:0,scale=1080:1920',
      '-preset', 'veryfast',
      outputPath,
    ];

    console.log('FFmpeg command: ffmpeg ' + ffmpegArgs.join(' '));

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ffmpegArgs);

      ff.stderr.on('data', (data) => {
        console.log('ffmpeg stderr:', data.toString());
      });

      ff.on('close', (code, signal) => {
        console.log('ffmpeg closed. code:', code, 'signal:', signal);
        // Trattiamo anche SIGKILL come "ok" se il file è stato creato
        if (code === 0 || signal === 'SIGKILL') {
          resolve();
        } else {
          reject(new Error(`ffmpeg failed with code ${code} signal ${signal}`));
        }
      });
    });

    console.log('FFmpeg done');

    // 3) Placeholder: genera un URL pubblico finto basato sul nome file.
    // Sostituisci fakePublicBase con il tuo dominio / storage reale.
    const fakePublicBase = 'https://example.com/videos'; // TODO: cambia con il tuo
    const fileName = path.basename(outputPath);
    const outputUrl = `${fakePublicBase}/${fileName}`;

    console.log('Returning output_url to edge function:', outputUrl);

    // 4) Risposta JSON per la edge function Supabase
    return res.json({
      ok: true,
      job_id,
      account_id,
      preset_key,
      output_url: outputUrl,
    });
  } catch (err) {
    console.error('Error in /process:', err);
    return res.status(500).json({
      error: 'Processor failed',
      details: err.message,
    });
  }
});

app.get('/', (_req, res) => {
  res.send('Video processor running');
});

app.listen(PORT, () => {
  console.log(`Processor listening on port ${PORT}`);
});






const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotta base per controllo
app.get("/", (req, res) => {
  res.json({ ok: true, message: "VideoViral processor is running" });
});

// Scarica il video da URL in un file locale usando fetch (Node 18+)
async function downloadVideo(videoUrl, outputPath) {
  console.log("Downloading video to:", outputPath);

  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Download failed, status: ${res.status}`);
  }

  const nodeStream = Readable.fromWeb(res.body);

  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);

    nodeStream.pipe(fileStream);
    nodeStream.on("error", (err) => {
      console.error("Stream error while downloading:", err);
      reject(err);
    });
    fileStream.on("finish", () => {
      console.log("Download done");
      resolve();
    });
    fileStream.on("error", (err) => {
      console.error("File write error:", err);
      reject(err);
    });
  });
}

// Esegue ffmpeg per crop 9:16 e scala 1080x1920
async function runFfmpeg(inputPath, outputPath) {
  console.log("Running ffmpeg crop 9:16…");

  const ffmpegArgs = [
    "-y",
    "-i",
    inputPath,
    "-vf",
    'crop=in_h*9/16:in_h:(in_w-out_w)/2:0,scale=1080:1920',
    "-preset",
    "veryfast",
    outputPath,
  ];

  console.log("FFmpeg command:", ["ffmpeg", ...ffmpegArgs].join(" "));

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.log(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on("close", (code, signal) => {
      console.log("ffmpeg closed. code:", code, "signal:", signal);

      // Consideriamo ok sia code === 0 sia code === null (alcuni wrapper danno null)
      if (code === 0 || code === null) {
        console.log("FFmpeg done (treated as success)");
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${code}, signal ${signal}`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("Error spawning ffmpeg:", err);
      reject(err);
    });
  });
}

app.post("/process", async (req, res) => {
  const { job_id, account_id, video_url, preset_key, pipeline } = req.body || {};

  console.log("=== New /process call ===");
  console.log("job_id:", job_id);
  console.log("account_id:", account_id);
  console.log("video_url:", video_url);
  console.log("preset_key:", preset_key);
  console.log("pipeline:", pipeline);

  try {
    if (!video_url) {
      return res
        .status(400)
        .json({ success: false, error: "video_url is required" });
    }

    const workDir = "/tmp";
    const safeJobId = (job_id || "job")
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, "");
    const safePreset = (preset_key || "output")
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, "");
    const inputPath = path.join(workDir, `${safeJobId}-${safePreset}-input.mp4`);
    const outputPath = path.join(
      workDir,
      `${safeJobId}-${safePreset}-output.mp4`
    );

    await downloadVideo(video_url, inputPath);
    await runFfmpeg(inputPath, outputPath);

    const slug = (preset_key || "output").toString().replace(/\s+/g, "-");
    const output_url = `file://${outputPath}`;
    console.log("Generated output_url:", output_url);

    res.json({
      success: true,
      output_url,
      job_id,
      preset_key,
    });
  } catch (err) {
    console.error("Error in /process:", err);
    res.status(500).json({ success: false, error: "Processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Processor listening on port ${PORT}`);
});


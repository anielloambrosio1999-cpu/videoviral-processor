const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotta base per controllo
app.get("/", (req, res) => {
  res.json({ ok: true, message: "VideoViral processor is running" });
});

// Rotta principale: /process
app.post("/process", async (req, res) => {
  try {
    const { job_id, account_id, video_url, preset_key, pipeline } = req.body;

    console.log("=== New /process call ===");
    console.log("job_id:", job_id);
    console.log("account_id:", account_id);
    console.log("video_url:", video_url);
    console.log("preset_key:", preset_key);
    console.log("pipeline:", pipeline);

    if (!video_url) {
      return res
        .status(400)
        .json({ success: false, error: "video_url is required" });
    }

    // Directory di lavoro (su Railway /tmp è scrivibile)
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

    console.log("Downloading video to:", inputPath);

    // Scarica il video sorgente
    await new Promise((resolve, reject) => {
      exec(`curl -L "${video_url}" -o "${inputPath}"`, (err, stdout, stderr) => {
        if (err) {
          console.error("Download error:", err, stderr);
          return reject(err);
        }
        console.log("Download done");
        resolve(null);
      });
    });

    console.log("Running ffmpeg crop 9:16…");

    // Crop al centro + scala 1080x1920 (verticale)
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vf "crop=in_h*9/16:in_h:(in_w-out_w)/2:0,scale=1080:1920" -preset veryfast "${outputPath}"`;
    console.log("FFmpeg command:", ffmpegCmd);

    await new Promise((resolve, reject) => {
      exec(ffmpegCmd, (err, stdout, stderr) => {
        if (err) {
          console.error("FFmpeg error:", err, stderr);
          return reject(err);
        }
        console.log("FFmpeg done");
        resolve(null);
      });
    });

    const output_url = `file://${outputPath}`;
    console.log("Generated output_url:", output_url);

    res.json({
      success: true,
      job_id,
      account_id,
      preset_key,
      output_url,
    });
  } catch (err) {
    console.error("Error in /process:", err);
    res
      .status(500)
      .json({ success: false, error: "Processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Processor listening on port ${PORT}`);
});

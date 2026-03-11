const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/process", async (req, res) => {
  const {
    job_id,
    account_id,
    video_url,
    preset_key,
    pipeline,
    upload_url,
    upload_token,
    public_output_url,
  } = req.body;

  console.log(`[process] job=${job_id} preset=${preset_key}`);
  console.log(`[process] video_url=${video_url}`);
  console.log(`[process] upload_url=${upload_url ? "YES" : "NO"}`);
  console.log(`[process] public_output_url=${public_output_url}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "proc-"));
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    // 1. Download source video
    console.log("[process] downloading source video...");
    const videoRes = await fetch(video_url);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: HTTP ${videoRes.status}`);
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fs.writeFileSync(inputPath, videoBuffer);
    console.log(`[process] downloaded ${videoBuffer.length} bytes`);

    // 2. Process with ffmpeg (crop to 9:16)
    console.log("[process] running ffmpeg...");
    const ffmpegCmd = [
      "ffmpeg", "-y",
      "-i", inputPath,
      "-vf", "crop=ih*9/16:ih",
      "-c:v", "libx264",
      "-preset", "fast",
      "-c:a", "aac",
      outputPath,
    ].join(" ");

    execSync(ffmpegCmd, { stdio: "pipe", timeout: 300000 });

    const outputStats = fs.statSync(outputPath);
    console.log(`[process] ffmpeg done, output size = ${outputStats.size} bytes`);

    // 3. Upload to Supabase Storage via signed URL
    if (upload_url) {
      console.log("[process] uploading to Supabase Storage...");

      const fileBuffer = fs.readFileSync(outputPath);

      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
        },
        body: fileBuffer,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload to Storage failed: HTTP ${uploadRes.status} - ${errText}`);
      }

      console.log("[process] upload successful!");

      res.json({
        ok: true,
        output_url: public_output_url,
      });
    } else {
      // Fallback: no signed URL provided (legacy mode)
      console.warn("[process] no upload_url provided, returning placeholder URL");
      res.json({
        ok: true,
        output_url: `https://placeholder.example.com/${job_id}/${preset_key}.mp4`,
      });
    }
  } catch (err) {
    console.error("[process] ERROR:", err.message);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Processor listening on port ${PORT}`));





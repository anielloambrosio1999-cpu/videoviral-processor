const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------- Supabase client (service role) ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Bucket dove salviamo i video generati
const OUTPUT_BUCKET = "outputs";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "WARN: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY non sono configurate. L'upload fallirà."
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
        },
      })
    : null;

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
async function runFfmpeg(i




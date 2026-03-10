const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotta base per vedere se il servizio funziona
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

    // v1: facciamo finta di lavorare
    await new Promise((r) => setTimeout(r, 2000));

    const slug = (preset_key || "output").toString().replace(/\s+/g, "-");
    const output_url = `https://example.com/videos/${job_id}/${slug}.mp4`;

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
    res.status(500).json({ success: false, error: "Processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Processor listening on port ${PORT}`);
});


const Tesseract = require('tesseract.js');
const fs = require('fs');

/**
 * Reads an uploaded screenshot and extracts kills and rankings via OCR
 */
exports.processScoreScreenshot = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image uploaded." });
    }

    const imagePath = req.file.path;

    // Run Tesseract OCR on the uploaded image
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');

    // Clean up local temp image file
    fs.unlinkSync(imagePath);

    // Simple parser matching text patterns (e.g., "Kills: 5", "Rank: 1")
    const killsMatch = text.match(/kills?\s*[:\-]?\s*(\d+)/i);
    const rankMatch = text.match(/rank\s*[:\-]?\s*(\d+)|#(\d+)/i);

    const extractedKills = killsMatch ? parseInt(killsMatch[1], 10) : 0;
    const extractedRank = rankMatch ? parseInt(rankMatch[1] || rankMatch[2], 10) : 1;

    res.status(200).json({
      success: true,
      message: "Screenshot parsed successfully!",
      extractedData: {
        rawText: text,
        suggestedKills: extractedKills,
        suggestedPlacement: extractedRank
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
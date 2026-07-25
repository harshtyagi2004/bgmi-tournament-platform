const tesseract = require('tesseract.js');
const fs = require('fs');

exports.processScoreScreenshot = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No screenshot uploaded." });
    }

    const imagePath = req.file.path;

    // Perform OCR scan
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng');

    // Simple regex extraction for Demo (looks for numbers/team names)
    console.log("--- OCR Scanned Text --- \n", text);

    // Clean up temporary uploaded file
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    res.status(200).json({
      success: true,
      message: "Screenshot scanned successfully!",
      extractedText: text
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
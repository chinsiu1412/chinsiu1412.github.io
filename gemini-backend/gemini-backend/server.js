/* Khai báo thư viện và khởi tạo web */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

/* Cấu hình Middleware */
app.use(cors());
app.use(express.json());

/* Kiểm tra bảo mật và kết nối */
if (!process.env.GEMINI_API_KEY) {
  console.error("LỖI: Chưa cấu hình GEMINI_API_KEY trong môi trường!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash"});

/* 1. Endpoint xử lý tin nhắn Chatbot */
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
  }

  // Cơ chế tự động thử lại tối đa 2 lần khi Google quá tải
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      const result = await model.generateContent(message);
      const reply = result.response.text();
      return res.json({ reply });
    } catch (error) {
      attempts++;
      console.error(`Lần thử ${attempts} thất bại:`, error.message);

      if (attempts >= maxAttempts) {
        if (error.status === 503 || (error.message && error.message.includes('503'))) {
          return res.status(503).json({ 
            reply: "Hệ thống AI của Google hiện đang quá tải. Bạn vui lòng bấm Gửi lại sau vài giây nhé!" 
          });
        }
        return res.status(500).json({ reply: "Đã xảy ra lỗi khi kết nối với AI: " + error.message });
      }
      
      // Chờ 1 giây trước khi thử lại
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
});

/* 2. Route kiểm tra các model Gemini được API Key hỗ trợ */
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();

    const supportedModels = data.models
      ? data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
          .map(m => m.name.replace("models/", ""))
      : data;

    res.json({ supportedModels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Khởi chạy server */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
});
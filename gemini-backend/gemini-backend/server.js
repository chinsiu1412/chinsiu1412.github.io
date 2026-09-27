/* Khai báo thư viện và khởi tạo web */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

/* Cấu hình Trust Proxy (BẮT BUỘC khi deploy trên Render/Heroku để rateLimit chạy đúng) */
app.set('trust proxy', 1);

/* Cấu hình Middleware */
app.use(cors({
  origin: ["https://chinsiu1412.github.io"],
}));
app.use(express.json());

/* Kiểm tra bảo mật và kết nối */
if (!process.env.GEMINI_API_KEY) {
  console.error("LỖI: Chưa cấu hình GEMINI_API_KEY trong môi trường!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

/* Giới hạn 10 request/phút/IP cho endpoint chat, tránh cháy quota free tier */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { reply: "Bạn đang gửi quá nhanh, vui lòng chờ một chút." }
});

/* ---------------------------------------------------------------------
   Bộ nhớ hội thoại theo phiên (session), lưu tạm trong RAM — không cần
   database, phù hợp cho prototype. Mỗi sessionId giữ 1 đối tượng "chat"
   của Gemini SDK, đối tượng này tự quản lý lịch sử hội thoại bên trong.
   Lưu ý: dữ liệu sẽ mất khi restart server (chấp nhận được với prototype).
--------------------------------------------------------------------- */
const conversations = new Map(); // sessionId -> { chat, lastActive }
const SESSION_TTL_MS = 30 * 60 * 1000; // hết hạn sau 30 phút không hoạt động

function getOrCreateChat(sessionId) {
  const existing = conversations.get(sessionId);
  if (existing) {
    existing.lastActive = Date.now();
    return existing.chat;
  }
  const chat = model.startChat({ history: [] });
  conversations.set(sessionId, { chat, lastActive: Date.now() });
  return chat;
}

// Dọn các session không hoạt động lâu, tránh rò rỉ bộ nhớ khi chạy demo dài
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of conversations.entries()) {
    if (now - data.lastActive > SESSION_TTL_MS) {
      conversations.delete(id);
    }
  }
}, 10 * 60 * 1000);

/* 1. Endpoint xử lý tin nhắn Chatbot */
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Nội dung tin nhắn không hợp lệ' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Tin nhắn quá dài (tối đa 2000 ký tự)' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Thiếu sessionId — mỗi phiên chat cần 1 mã định danh riêng' });
  }

  const chat = getOrCreateChat(sessionId);

  // Cơ chế tự động thử lại tối đa 2 lần khi Google quá tải
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      const result = await chat.sendMessage(message);
      const reply = result.response.text();
      return res.json({ reply });
    } catch (error) {
      attempts++;
      console.error(`Lần thử ${attempts} thất bại:`, error.message);

      if (attempts >= maxAttempts) {
        // Log đầy đủ chi tiết lỗi ở phía server (chỉ mình bạn nhìn thấy, trong terminal/log file)
        console.error("Lỗi chi tiết khi gọi Gemini API:", error);

        if (error.status === 503 || (error.message && error.message.includes('503'))) {
          return res.status(503).json({
            reply: "Hệ thống AI của Edupath AI hiện đang quá tải. Bạn vui lòng bấm Gửi lại sau vài giây nhé!"
          });
        }

        // Chỉ trả message CHUNG cho client, không lộ error.message ra ngoài
        return res.status(500).json({
          reply: "Đã xảy ra lỗi khi kết nối với AI. Vui lòng thử lại sau."
        });
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
    console.error("Lỗi khi lấy danh sách model:", error);
    res.status(500).json({ error: "Không thể lấy danh sách model." });
  }
});

/* Khởi chạy server */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
});
/*Khai báo thư viện và khởi tạo web*/

require('dotenv').config(); 
/*Tải các biến từ env vào process.env*/

const express = require('express');
/*khởi tạo framework express để tạo server*/

const cors = require('cors');
/*Thư viện xử lí cơ chế*/

const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();

/*Cấu hình Middleware*/
app.use(cors());
app.use(express.json());

/*Kiểm tra bảo mật và kết nối*/
if (!process.env.GEMINI_API_KEY) {
    console.error("LỖI: Chưa cấu hình GEMINI_API_KEY trong môi trường!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/*Định nghĩa Endpoint API để tiếp nhận yêu cầu*/
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
        }

        const result = await model.generateContent(message);
        const reply = result.response.text();

        res.json({ reply });
    } catch (error) {
        console.error("Lỗi xử lý Gemini API:", error);
        res.status(500).json({ error: 'Đã xảy ra lỗi kết nối phía Server' });
    }
});

/*Khởi chạy server*/
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
});
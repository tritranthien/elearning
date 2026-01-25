# ⚡ LinguaFast

LinguaFast là ứng dụng học tiếng Anh thông minh được thiết kế đặc biệt cho người Việt, sử dụng AI để tối ưu hóa quá trình ghi nhớ từ vựng và luyện tập hội thoại.

## ✨ Tính năng nổi bật

- 📚 **Học từ vựng theo chủ đề**: Hàng chục bộ từ vựng được biên soạn sẵn với hình ảnh, âm thanh và ví dụ minh họa sinh động.
- 🤖 **Tích hợp AI (Gemini)**: Tự động tạo bộ từ vựng theo yêu cầu, dịch thuật thông minh và phân tích ngữ pháp.
- 🎤 **Luyện hội thoại thông minh**: Nói tiếng Việt, AI sẽ dịch sang tiếng Anh tự nhiên và trích xuất các mẫu câu, từ vựng quan trọng để bạn học.
- 🧩 **Chương trình học đa dạng**: Flashcard, ghép từ, trắc nghiệm và thử thách chính tả giúp bạn nhớ từ vựng sâu hơn.
- 📖 **Từ điển cá nhân**: Tra cứu từ mới và lưu vào bộ sưu tập riêng của bạn.
- 📱 **PWA (Progressive Web App)**: Cài đặt ứng dụng lên điện thoại, sử dụng mượt mà như ứng dụng bản địa và hỗ trợ ngoại tuyến cơ bản.

## 🛠 Công nghệ sử dụng

- **Framework**: React Router v7 (với SSR)
- **Database**: MongoDB & Prisma ORM
- **Styling**: TailwindCSS v4
- **AI**: Google Gemini Pro API
- **State Management**: React Hooks & React Router Loaders/Actions
- **PWA**: Service Workers & Web App Manifest

## 🚀 Bắt đầu nhanh

### Cài đặt
```bash
npm install
```

### Cấu hình môi trường
Tạo file `.env` và thêm các biến sau:
```env
DATABASE_URL="your_mongodb_url"
GEMINI_API_KEY="your_gemini_api_key"
SESSION_SECRET="your_random_secret"
```

### Chạy phát triển
```bash
npx prisma db push
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173`.

## 📦 Xây dựng sản phẩm

```bash
npm run build
npm start
```

---
Phát triển bởi đội ngũ LinguaFast với ❤️.

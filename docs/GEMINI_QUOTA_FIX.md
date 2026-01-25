# 🔧 Hướng dẫn xử lý lỗi Gemini API Quota

## ❌ Vấn đề hiện tại

Ứng dụng đang gặp lỗi khi tạo gợi ý trong hội thoại vì:
1. **Quota API Gemini đã vượt giới hạn** (429 Too Many Requests)
2. **Lỗi JSON parsing** với một số model

## ✅ Đã khắc phục

### 1. **Cải thiện xử lý lỗi trong `ai.server.ts`**
- ✨ Thêm retry logic thông minh (2 lần thử mỗi model)
- ✨ Cải thiện JSON parsing với error handling tốt hơn
- ✨ Phát hiện và xử lý quota errors riêng biệt
- ✨ Thông báo lỗi chi tiết và hữu ích hơn
- ✨ Exponential backoff khi gặp lỗi

### 2. **Tạo script kiểm tra quota**
- Chạy lệnh: `npx tsx scripts/check-gemini-quota.ts`
- Script sẽ kiểm tra trạng thái của tất cả 4 API keys
- Hiển thị thời gian cần đợi nếu quota exceeded

## 📊 Kết quả kiểm tra quota hiện tại

Dựa vào kết quả, tình trạng các API keys:

| API Key | gemini-2.0-flash | gemini-2.5-flash | gemini-2.5-pro |
|---------|------------------|------------------|----------------|
| MAIN | ⚠️ Quota exceeded | ✅ OK | ⚠️ Quota exceeded |
| LEARN | ⚠️ Quota exceeded | ✅ OK | ⚠️ Quota exceeded |
| DICTIONARY | ⚠️ Quota exceeded | ✅ OK | ⚠️ Quota exceeded |
| PRACTICE | ⚠️ Quota exceeded | ✅ OK | ⚠️ Quota exceeded |

**✅ Tin tốt:** Model `gemini-2.5-flash` vẫn hoạt động tốt với tất cả các keys!

## 🚀 Giải pháp ngay lập tức

### Option 1: Đợi quota reset (Đơn giản nhất)
Gemini Free Tier reset:
- **Per minute limit**: Đợi 1-2 phút
- **Per day limit**: Đợi đến nửa đêm (UTC)

### Option 2: Tạo thêm API keys mới (Khuyến nghị)
1. Truy cập: https://aistudio.google.com/app/apikey
2. Tạo 4 API keys mới (hoặc dùng các tài khoản Google khác nhau)
3. Cập nhật trong file `.env`:
   ```env
   GEMINI_API_KEY=<new_key_1>
   GEMINI_API_KEY_LEARN=<new_key_2>
   GEMINI_API_KEY_DICTIONARY=<new_key_3>
   GEMINI_API_KEY_PRACTICE=<new_key_4>
   ```
4. Restart dev server: `npm run dev`

### Option 3: Tối ưu hóa việc sử dụng API (Dài hạn)

#### A. Giảm số lần gọi API
Trong `practice.tsx`, bạn đang:
- ✅ Đã có auto-generate suggestions (tốt!)
- ⚠️ Nhưng vẫn cho phép manual suggest

**Khuyến nghị:** Ưu tiên sử dụng pre-generated suggestions thay vì manual.

#### B. Cache suggestions
Thêm caching cho suggestions để tái sử dụng:
```typescript
// Trong loader của practice.tsx
suggestions: {
  where: { isUsed: false },
  orderBy: { createdAt: "desc" },
  take: 20 // Tăng từ 10 lên 20 để có nhiều gợi ý sẵn
}
```

#### C. Giảm conversation history size
Trong `ai.server.ts`, đã giảm từ 10 xuống 5:
```typescript
take: 5 // Reduced from 10 to save tokens
```

## 🎯 Chiến lược tối ưu quota

### Giới hạn Free Tier của Gemini:
- **gemini-2.0-flash**: 15 requests/minute, 1,500 requests/day
- **gemini-2.5-flash**: 15 requests/minute, 1,500 requests/day
- **gemini-2.5-pro**: 2 requests/minute, 50 requests/day

### Phân bổ khuyến nghị:
1. **LEARN key** (Generate words): ~100-200 requests/day
2. **DICTIONARY key** (Lookup words): ~300-400 requests/day
3. **PRACTICE key** (Conversations & Suggestions): ~500-800 requests/day
4. **MAIN key** (Backup): Reserve for critical operations

### Lời khuyên:
- Sử dụng `gemini-2.5-flash` làm model ưu tiên (hiện đang available)
- Chỉ fallback sang `gemini-2.5-pro` khi thực sự cần (vì limit thấp hơn)
- Implement caching ở client-side cho suggestions đã dùng
- Batch multiple operations when possible

## 🔍 Monitoring

Chạy script kiểm tra thường xuyên:
```bash
npx tsx scripts/check-gemini-quota.ts
```

Xem logs trong terminal khi dev:
```bash
npm run dev
```

Logs sẽ show:
- `[AI SuggestNext] Attempting with model: ...`
- `⚠️ Quota exceeded for ...`
- `✅ Success! ...`

## 📚 Tham khảo

- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Get API Keys](https://aistudio.google.com/app/apikey)
- [Monitor Usage](https://ai.dev/rate-limit)

---

**Cập nhật:** 2026-01-25
**Trạng thái:** ✅ Code đã được cải thiện, chờ quota reset hoặc tạo keys mới

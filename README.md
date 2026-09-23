# Trợ lý học liệu nội bộ — THCS Lộc Ninh

Ứng dụng hai chế độ dành cho giáo viên: **Cơ bản** (lệnh ngắn, chi phí thấp) và **Nâng cao** (ngữ cảnh dài, chọn OpenAI/Gemini). Giao diện chạy trên GitHub Pages; mọi khóa AI được giữ trong Supabase Edge Function.

## Kiến trúc

- Frontend tĩnh: `index.html`, `styles.css`, `app.js`.
- Đăng nhập, hạn mức, nhật ký token: Supabase Auth + Postgres/RLS.
- Cổng AI bảo mật: `supabase/functions/ai-assistant`.
- Model mặc định: `gpt-6-luna`; có thể chọn `gpt-6-sol`, Gemini Flash-Lite hoặc Flash ở chế độ Nâng cao.

## Thiết lập Supabase

1. Mở SQL Editor của project `ckviatjyhrhfhejugkgs` và chạy nội dung migration trong `supabase/migrations/20260923000000_school_ai.sql`.
2. Vào **Edge Functions**, tạo function tên `ai-assistant`, thay mã bằng `supabase/functions/ai-assistant/index.ts`, rồi deploy.
3. Vào **Edge Functions → Secrets**, thêm:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
4. Trong Authentication, bật Email provider và cấu hình Site URL là `https://huycomf2020.github.io/schoolAI/`.

Không đặt khóa OpenAI/Gemini trong `config.js`, GitHub Secrets dành cho frontend, hay bất kỳ tệp nào được trình duyệt tải xuống.

## Triển khai GitHub Pages

Workflow `.github/workflows/pages.yml` tự triển khai khi có commit vào `main`. Trong **Settings → Pages**, chọn **Source: GitHub Actions** nếu repository chưa bật Pages.

## Hạn mức mặc định

| Chế độ | Prompt | Output tối đa | Lượt/24 giờ/người |
|---|---:|---:|---:|
| Cơ bản | 600 ký tự | 700 token | 30 |
| Nâng cao | 8.000 ký tự + 20.000 ký tự ngữ cảnh | 4.000 token | 15 |

Các hạn mức được kiểm tra cả ở giao diện và Edge Function.

## Phát triển cục bộ

Chạy một web server tĩnh, ví dụ `python3 -m http.server 8080`, rồi mở `http://localhost:8080`. Không mở trực tiếp bằng `file://` vì ES modules cần HTTP.

## Người đề xuất

Phó Hiệu trưởng **Tô Thị Mơ** — Trường THCS Lộc Ninh.

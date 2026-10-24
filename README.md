# LinMaster

> **Lin** trong *Linguistic*. Nền tảng web học ngoại ngữ dùng AI, kết hợp trích xuất từ vựng theo ngữ cảnh và phòng thi mô phỏng thi máy (CBT).

Đồ án môn **Phát triển ứng dụng Web (MSIS207)** — Trường Đại học Công nghệ Thông tin, ĐHQG-HCM.
Giảng viên hướng dẫn: ThS. Nguyễn Thanh Bình / ThS. Trần Vĩnh Khiêm.

## Tổng quan đề tài

Người học ngoại ngữ, đặc biệt là người luyện IELTS, thường gặp hai khó khăn:
- Học từ vựng theo danh sách rời rạc, không có ngữ cảnh nên nhanh quên.
- Bỡ ngỡ với giao diện thi trên máy tính.

Các nền tảng hiện có thường chỉ giải quyết một trong hai vấn đề này.

**LinMaster** nối việc luyện thi và học từ thành một vòng học khép kín:

**Thi thử → Trích từ vựng từ chính bài vừa thi → Ôn flashcard → Theo dõi tiến bộ → Thi lại**

| Module | Chức năng |
|---|---|
| **Trích xuất từ vựng** | Dán văn bản hoặc tải file PDF/DOCX/TXT. AI chọn ra các từ đúng trình độ mục tiêu, kèm IPA, nghĩa Anh–Việt, câu ví dụ lấy từ chính bài gốc và collocations |
| **Phòng thi CBT** | Reading và Listening trên giao diện mô phỏng thi máy: chia đôi màn hình, highlight, gạch bỏ phương án, đánh dấu câu, đồng hồ đếm ngược, tự lưu bài. Nộp bài là có điểm, band ước tính và giải thích kèm bằng chứng trong bài |
| **Flashcard** | Ôn từ đã lưu theo thuật toán lặp lại ngắt quãng SM-2 |
| **Dashboard** | Xu hướng điểm, số từ đã học, các dạng câu hỏi hay sai |

## Tài liệu dự án

| Tài liệu | Nội dung |
|---|---|
| [docs/Working_rules.md](docs/Working_rules.md) | Luật và quy trình làm việc cho thành viên và AI Agent: Git, PR, review, quy chuẩn code, API, bảo mật, deploy, checklist |
| [docs/Project_Structure.md](docs/Project_Structure.md) | Tech stack, kiến trúc, cấu trúc thư mục và giải thích chi tiết |
| [docs/PLAN.md](docs/PLAN.md) | Kế hoạch, phạm vi và lộ trình (đang tinh chỉnh) |

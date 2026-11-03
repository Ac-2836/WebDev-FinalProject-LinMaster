# Analysis & Design — LinMaster

Bộ phân tích và thiết kế của Giai đoạn 0 (PLAN Phần D, issue P0-03 → P0-11). Quy ước ở PLAN mục B6.

- Mỗi sơ đồ là **một file `.puml`** (nguồn) và **một ảnh `.png`** cùng tên đặt cạnh nhau.
- Kiểu chung của mọi sơ đồ: [`_style.iuml`](_style.iuml).
- Sửa sơ đồ = sửa file `.puml` rồi xuất lại ảnh. Không sửa ảnh bằng tay.

## Xuất ảnh

Cần Java, `plantuml.jar` và Graphviz. Mặc định script tìm chúng trong `~/.plantuml/`. Muốn dùng chỗ khác thì đặt biến `PLANTUML_JAR` và `GRAPHVIZ_DOT`.

```bash
bash Analysis_Design/render.sh                       # xuất tất cả
bash Analysis_Design/render.sh 03_Activity/act-05-tai-de.puml   # xuất một sơ đồ (đường dẫn tính từ Analysis_Design/)
```

## Mục lục

### 01 — Cơ sở dữ liệu (P0-05)
| Sơ đồ | Nội dung |
|---|---|
| [erd-00-tong-quan](01_Database/erd-00-tong-quan.png) | Toàn bộ bảng và quan hệ, gom theo module |
| [erd-01-auth-core](01_Database/erd-01-auth-core.png) | User, AiCache, AiUsage, StoredFile |
| [erd-02-vocab](01_Database/erd-02-vocab.png) | Document, VocabEntry, VocabContext, VocabLookup |
| [erd-03-flashcard](01_Database/erd-03-flashcard.png) | FlashcardSet, Card, CardProgress, StudySession, ReviewLog |
| [erd-04-exam](01_Database/erd-04-exam.png) | Test → TestSection → Passage → QuestionGroup → Question; TestImport; Attempt, AttemptAnswer |
| [erd-05-library](01_Database/erd-05-library.png) | Report và các cột công khai |
| [erd-06-enums](01_Database/erd-06-enums.png) | Các kiểu liệt kê |
| [data-dictionary.md](01_Database/data-dictionary.md) | Từ điển dữ liệu: cột, ràng buộc, index, quy tắc xóa |

### 02 — Use case (P0-03, P0-04)
| Sơ đồ | Nội dung |
|---|---|
| [uc-00-tong-quat](02_UseCase/uc-00-tong-quat.png) | Use case tổng quát |
| [uc-01-auth](02_UseCase/uc-01-auth.png) | Phân rã: tài khoản |
| [uc-02-vocab](02_UseCase/uc-02-vocab.png) | Phân rã: đọc và học từ |
| [uc-03-flashcard](02_UseCase/uc-03-flashcard.png) | Phân rã: flashcard |
| [uc-04-exam](02_UseCase/uc-04-exam.png) | Phân rã: thi thử |
| [uc-05-library](02_UseCase/uc-05-library.png) | Phân rã: kho cộng đồng |
| [uc-06-stats-home](02_UseCase/uc-06-stats-home.png) | Phân rã: dashboard và trang chủ |
| [use-case-specs.md](02_UseCase/use-case-specs.md) | Đặc tả các use case chính |

### 03 — Activity (P0-06, P0-07)
| Sơ đồ | Nội dung |
|---|---|
| [act-01-tra-va-luu-tu](03_Activity/act-01-tra-va-luu-tu.png) | Đọc tài liệu, tra từ, lưu từ |
| [act-02-loc-nhanh-tu](03_Activity/act-02-loc-nhanh-tu.png) | Lọc nhanh từ theo CEFR / chủ đề |
| [act-03-soan-bo-the](03_Activity/act-03-soan-bo-the.png) | Tạo / sửa bộ thẻ |
| [act-04-hoc-the-srs](03_Activity/act-04-hoc-the-srs.png) | Học thẻ theo SM-2 |
| [act-05-tai-de](03_Activity/act-05-tai-de.png) | Tải đề lên |
| [act-06-lam-bai-thi](03_Activity/act-06-lam-bai-thi.png) | Làm bài thi CBT, tự lưu, nộp bài |
| [act-07-dang-len-kho](03_Activity/act-07-dang-len-kho.png) | Đăng lên / gỡ khỏi kho |
| [act-08-dung-kho](03_Activity/act-08-dung-kho.png) | Tìm, xem trước, chép, làm đề, báo cáo |

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
| [use-case-specs.md](02_UseCase/use-case-specs.md) | Đặc tả mọi use case (UC01–UC51) |

### 03 — Activity (P0-06, P0-07)
| Sơ đồ | Nội dung |
|---|---|
| [act-01-tra-va-luu-tu](03_Activity/act-01-tra-va-luu-tu.png) | Đọc tài liệu, tra từ, lưu từ |
| [act-02-loc-nhanh-tu](03_Activity/act-02-loc-nhanh-tu.png) | Lọc nhanh từ theo CEFR / chủ đề (một lần gọi AI cho cả tài liệu) |
| [act-03-soan-bo-the](03_Activity/act-03-soan-bo-the.png) | Tạo / sửa bộ thẻ |
| [act-04-hoc-the-srs](03_Activity/act-04-hoc-the-srs.png) | Học thẻ theo SM-2 |
| [act-05-tai-de](03_Activity/act-05-tai-de.png) | Tải đề lên |
| [act-06-lam-bai-thi](03_Activity/act-06-lam-bai-thi.png) | Làm bài thi CBT, tự lưu, nộp bài |
| [act-07-dang-len-kho](03_Activity/act-07-dang-len-kho.png) | Đăng lên / gỡ khỏi kho |
| [act-08-dung-kho](03_Activity/act-08-dung-kho.png) | Tìm, xem trước, chép, làm đề, báo cáo |
| [act-09-luyen-tap-ai](03_Activity/act-09-luyen-tap-ai.png) | Luyện tập do AI sinh từ bộ thẻ |

### 04 — Sequence (P0-08, P0-09)
| Sơ đồ | Nội dung |
|---|---|
| [seq-01-dang-nhap](04_Sequence/seq-01-dang-nhap.png) | Đăng nhập, cấp JWT |
| [seq-02-tra-tu](04_Sequence/seq-02-tra-tu.png) | Tra từ theo ngữ cảnh qua AI gateway (quota, cache, thử lại, kiểm tra cụm AI giải nghĩa) |
| [seq-03-loc-nhanh](04_Sequence/seq-03-loc-nhanh.png) | Lọc nhanh và lưu nhiều từ |
| [seq-04-tai-de](04_Sequence/seq-04-tai-de.png) | Tải đề, job nền, AI nhận diện (cả transcript từ audio), kiểm tra |
| [seq-05-lam-bai-tu-luu](04_Sequence/seq-05-lam-bai-tu-luu.png) | Bắt đầu / tiếp tục làm bài, tự lưu |
| [seq-06-nop-va-cham](04_Sequence/seq-06-nop-va-cham.png) | Nộp bài và chấm điểm |
| [seq-07-mo-bai-doc-tu-ket-qua](04_Sequence/seq-07-mo-bai-doc-tu-ket-qua.png) | Mở passage của bài thi trong Trình đọc |
| [seq-08-hoc-the](04_Sequence/seq-08-hoc-the.png) | Học thẻ SM-2 |
| [seq-09-chep-bo-the](04_Sequence/seq-09-chep-bo-the.png) | Chép bộ thẻ từ kho |
| [seq-10-luyen-tap-ai](04_Sequence/seq-10-luyen-tap-ai.png) | Sinh bài luyện tập qua AI gateway |
| [seq-11-giai-thich-dap-an](04_Sequence/seq-11-giai-thich-dap-an.png) | Giải thích đáp án: từ file đề, hoặc do AI tạo |

### 05 — State (P0-10)
| Sơ đồ | Nội dung |
|---|---|
| [st-01-attempt](05_State/st-01-attempt.png) | Lượt làm bài (gồm Listening → Reading của đề Full) |
| [st-02-test-import](05_State/st-02-test-import.png) | Lượt tải đề |
| [st-03-cong-khai-noi-dung](05_State/st-03-cong-khai-noi-dung.png) | private / public / hidden |
| [st-04-tien-do-the](05_State/st-04-tien-do-the.png) | Mới / Đang học / Đã thuộc |

### 06 — Kiến trúc (P0-11)
| Sơ đồ | Nội dung |
|---|---|
| [arc-01-component](06_Architecture/arc-01-component.png) | Module client / server / shared và phụ thuộc |
| [arc-02-deployment-local](06_Architecture/arc-02-deployment-local.png) | Môi trường local và CI |
| [arc-03-deployment-online](06_Architecture/arc-03-deployment-online.png) | Vercel, Render, Neon, Backblaze B2, Gemini |
| [arc-04-class-module-registry](06_Architecture/arc-04-class-module-registry.png) | Hợp đồng module và các registry |
| [arc-05-class-tang-module](06_Architecture/arc-05-class-tang-module.png) | Ba tầng trong một module server |

### 07 — Wireframe (P0-12)
Prototype HTML bấm được (Tailwind qua CDN, cùng token màu với `client/app/globals.css`), không phải PlantUML.

| File | Nội dung |
|---|---|
| [index.html](07_Wireframe/index.html) | Mục lục 32 màn; nút **375 / 1440** xem hai khổ cạnh nhau. Trong mỗi màn: nút **Mục lục** (góc dưới trái) và bảng **WF** đổi trạng thái tải / trống / lỗi / hộp thoại (góc trên phải) |
| [wireframes.pdf](07_Wireframe/wireframes.pdf) | Bản in cho report: mỗi màn một trang, desktop 1440px và mobile 375px cạnh nhau |
| [design-system](07_Wireframe/00-foundation/design-system.html) | Logo, màu, chữ, nút, ô nhập, card, hộp thoại, trạng thái |
| [assets/logo-mark.svg](07_Wireframe/assets/logo-mark.svg), [assets/logo.svg](07_Wireframe/assets/logo.svg) | Logo LinMaster (biểu tượng, lockup ngang) |

Xem ở máy: `python -m http.server 8137 -d Analysis_Design/07_Wireframe` rồi mở `http://localhost:8137`. Thêm `?shot` vào URL để ẩn các nút của wireframe khi chụp ảnh.

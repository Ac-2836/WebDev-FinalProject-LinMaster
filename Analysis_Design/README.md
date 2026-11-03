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

### 02 — Use case (P0-03, P0-04)
| Sơ đồ | Nội dung |
|---|---|
| [uc-00-tong-quat](02_UseCase/uc-00-tong-quat.png) | Use case tổng quát |
| [uc-02-vocab](02_UseCase/uc-02-vocab.png) | Phân rã: đọc và học từ |
| [uc-03-flashcard](02_UseCase/uc-03-flashcard.png) | Phân rã: flashcard |
| [uc-04-exam](02_UseCase/uc-04-exam.png) | Phân rã: thi thử |
| [use-case-specs.md](02_UseCase/use-case-specs.md) | Đặc tả các use case chính |

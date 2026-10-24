# LinMaster — Kế hoạch triển khai chi tiết

> **LinMaster** — "Lin" trong *Linguistic*.
>
> **Mục tiêu đồ án:** trình bày ý tưởng web và có một sản phẩm ở mức cận production. Không làm phân cấp gói (subscription) hay thanh toán.

Tài liệu này là **kế hoạch thực thi** từ lúc repo còn trống đến khi website sẵn sàng nộp đồ án. Nó gồm:
- Kiến trúc module.
- Đặc tả từng module (dữ liệu, API, giao diện, quy tắc nghiệp vụ, test).
- Danh sách công việc theo từng giai đoạn: mỗi dòng là một Issue = một Pull Request.

Luật làm việc xem [Working_rules.md](Working_rules.md). Tech stack và cấu trúc thư mục xem [Project_Structure.md](Project_Structure.md). Chỗ nào ghi **[CẦN CHỐT]** là quyết định nhóm cần đưa ra.

---

## Mục lục

- **Phần A — Tổng quan:** [A1 Mục tiêu & phạm vi](#a1-mục-tiêu--phạm-vi) · [A2 Mốc thời gian](#a2-mốc-thời-gian) · [A3 Vai trò](#a3-vai-trò) · [A4 Tiêu chí chấm](#a4-tiêu-chí-chấm--cách-đáp-ứng)
- **Phần B — Kiến trúc module:** [B1 Danh sách module](#b1-danh-sách-module) · [B2 Phụ thuộc](#b2-đồ-thị-phụ-thuộc) · [B3 Hợp đồng module](#b3-hợp-đồng-module) · [B4 Điểm mở rộng](#b4-điểm-mở-rộng) · [B5 Chống xung đột](#b5-quy-tắc-chống-xung-đột-khi-phát-triển-song-song)
- **Phần C — Đặc tả module:** [C0 core](#c0-module-core) · [C1 auth](#c1-module-auth) · [C2 content](#c2-module-content) · [C3 exam](#c3-module-exam) · [C4 vocab](#c4-module-vocab) · [C5 flashcard](#c5-module-flashcard) · [C6 stats](#c6-module-stats)
- **Phần D — Kế hoạch theo giai đoạn:** [Giai đoạn 0 → 8](#phần-d--kế-hoạch-theo-giai-đoạn)
- **Phần E — Deploy & vận hành** · **Phần F — Định dạng file đề** · **Phần G — Rủi ro & phương án cắt giảm** · **Phần H — Việc cần chốt**

---

# Phần A — Tổng quan

## A1. Mục tiêu & phạm vi

### Định vị sản phẩm (từ khảo sát thị trường)

| Nhóm đối thủ | Họ mạnh ở | Họ thiếu |
|---|---|---|
| Thi thử (STUDY4, Prep, IELTS Online Tests, bản làm quen thi máy của IDP/BC) | Kho đề lớn, giao diện thi máy | Từ vựng học theo danh sách có sẵn, không lấy từ tài liệu của người học |
| Đọc và trích từ (LingQ, Readlang) | Lưu từ kèm câu ngữ cảnh | Người học tự bấm từng từ; không có phòng thi; không gắn IELTS |
| Flashcard (Anki, Quizlet) | Thuật toán ôn tập | Anki khó dùng, dễ dồn thẻ; Quizlet khóa nhiều chế độ |

**Điểm khác biệt:** một vòng học khép kín **Thi → Trích từ từ chính bài vừa thi → Ôn flashcard → Theo dõi → Thi lại**. AI tự chọn từ theo trình độ mục tiêu.

**Kho đề lớn (tầm nhìn):** giả định có thể nhập một kho đề quy mô lớn. Kiến trúc hỗ trợ sẵn: mỗi đề là một file JSON theo schema chung, nhập hàng loạt bằng lệnh import (Phần F). Đồ án demo bằng vài đề mẫu.

**Tránh:** công bố các con số kiểu "AI chấm chính xác X%" khi chưa đo được.

### Phạm vi MVP (bắt buộc hoàn thành)

| Module | Nội dung |
|---|---|
| **auth** | Đăng ký, đăng nhập, hồ sơ (tên, band mục tiêu), đăng xuất |
| **content** | Thư viện đề Reading/Listening; nhập đề từ file JSON |
| **exam** | Phòng thi CBT Reading + Listening: timer theo giờ server, chia đôi màn hình, highlight, gạch phương án, đánh dấu câu, autosave, nộp bài, chấm điểm, band ước tính, giải thích kèm bằng chứng, transcript |
| **vocab** | Trích từ bằng AI từ văn bản dán / file PDF-DOCX-TXT / bài vừa thi; kho từ cá nhân |
| **flashcard** | Bộ thẻ, ôn theo SM-2 có giới hạn mỗi ngày, bài trắc nghiệm do AI sinh |
| **stats** | Tổng quan, xu hướng band, số từ mới theo tuần, dạng câu hay sai, chuỗi ngày học |

**Nội dung tối thiểu:** 2 đề Reading + 2 đề Listening, mỗi đề đủ 40 câu, có đáp án và bằng chứng.

### Backlog mở rộng (chỉ làm khi vượt tiến độ, theo thứ tự)
1. Ghi chú (note) trong phòng thi.
2. Bài tập điền từ trong flashcard.
3. Xuất deck ra CSV.
4. Lời giải thích do AI viết thêm cho từng câu.
5. Dark mode.
6. Đề thứ 3 cho mỗi kỹ năng.

### Ngoài phạm vi (ghi vào report, mục "Hướng phát triển")
Writing/Speaking chấm bằng AI, nhập bài đọc từ URL, gợi ý bài luyện theo điểm yếu, thanh toán, ứng dụng mobile.

## A2. Mốc thời gian

> **[CẦN CHỐT]** Hạn nộp. Kế hoạch giả định hạn nộp là **CN 22/11/2026**.

| Giai đoạn | Thời gian | Nội dung | Mốc |
|---|---|---|---|
| 0 | T7 24/10 – CN 25/10 | Chuẩn bị: repo, công cụ, tài khoản, tên miền, khung code | Khung chạy được ở local, CI xanh |
| 1 | T2 26/10 – T4 28/10 | Nền móng: core + auth + deploy lên tên miền thật | Đăng nhập được trên production |
| 2 | T4 28/10 – CN 01/11 | Module vocab | **`v0.1`** — trích từ chạy online |
| 3 | T2 02/11 – T5 05/11 | Module content + exam (Reading) | Thi được Reading |
| 4 | T5 05/11 – CN 08/11 | Exam (Listening) + trang kết quả + vòng học | **`v0.2`** — vòng Thi → Trích từ chạy online |
| 5 | T2 09/11 – T4 11/11 | Module flashcard | Ôn thẻ được |
| 6 | T4 11/11 – T6 13/11 | Module stats + trang chủ | Đủ 6 module |
| 7 | T7 14/11 – CN 15/11 | **Đóng băng tính năng**, hoàn thiện, kiểm thử | **`v1.0`** |
| 8 | T2 16/11 – CN 22/11 | Report, slide, demo; chỉ sửa lỗi | `v1.0.x`, nộp bài |

## A3. Vai trò

| Vai trò | Phụ trách (mở PR) | Review |
|---|---|---|
| **Thành viên 1** — Front-end & UX Lead | Chủ yếu issue phía client, CI, board GitHub Projects, kiểm thử giao diện, dữ liệu seed | PR back-end |
| **Thành viên 2** — Back-end & AI Lead | Chủ yếu issue phía server, database, prompt AI, nội dung đề, deploy, tên miền | PR front-end |
| **AI Agent** (hỗ trợ) | Viết code, test, API doc theo từng issue được giao; tuân theo [Working_rules.md](Working_rules.md) mục 3 | — |

Mỗi issue trong Phần D có cột **Phụ trách**. Đó là người đọc hiểu code, mở PR bằng tài khoản của mình, và trả lời khi vấn đáp. Số issue được chia gần đều để lịch sử đóng góp của hai người cân bằng.

## A4. Tiêu chí chấm → cách đáp ứng

| Tiêu chí | Mức | Đáp ứng bằng |
|---|---|---|
| Lịch sử PR đều đặn, quản lý dự án sát thực tế | Cao | 75 issue nhỏ chia theo ngày (Phần D), board + milestone mỗi giai đoạn, review chéo, release theo mốc |
| Publishment tốt (deploy, quản lý web, tên miền) | Cao | Deploy production từ giai đoạn 1, tên miền riêng + HTTPS, preview cho mỗi PR, theo dõi uptime, quy trình rollback (Phần E) |
| Có database | Tối thiểu | PostgreSQL + Prisma, schema tách theo module, migration có lịch sử, seed |
| Có API doc (**bắt buộc Swagger**) | Tối thiểu | Swagger UI tại `https://api.<tên-miền>/docs`, sinh từ Zod schema; CI kiểm tra mọi route đều có doc |
| Hoàn thành chức năng | Tối thiểu | 6 module, mỗi module có tiêu chí hoàn thành (Phần C) |
| Thuyết trình, report | Tối thiểu | Giai đoạn 8 dành riêng; ảnh chụp và số liệu được thu thập từ đầu |

---

# Phần B — Kiến trúc module

## B1. Danh sách module

Hệ thống chia thành **1 module nền (`core`)** và **6 module nghiệp vụ**. Mỗi module nghiệp vụ có mặt ở cả ba nơi: server, client và shared. Ở mỗi nơi, nó nằm trong **một thư mục riêng mang tên module**.

| Module | Trách nhiệm | Sở hữu dữ liệu | Prefix API | Trang (client) |
|---|---|---|---|---|
| `core` | Hạ tầng chung: cấu hình, DB client, lỗi, validate, bảo mật, JWT, AI gateway, Swagger registry, nạp module; khung giao diện, API client, phiên đăng nhập | `AiUsage`, `AiCache` | `/health` | Layout, navbar, trang lỗi |
| `auth` | Tài khoản, đăng nhập, hồ sơ | `User` | `/auth` | `/login`, `/register`, `/profile` |
| `content` | Đề thi: lưu trữ, nhập từ file, cung cấp đề cho module khác | `Test`, `Section`, `QuestionGroup`, `Question` | `/tests` | `/tests`, `/tests/[testId]` |
| `exam` | Lần làm bài: bắt đầu, tự lưu, tính giờ, nộp, chấm, kết quả | `Attempt`, `AttemptAnswer` | `/attempts` | `/attempts/[id]`, `/attempts/[id]/result` |
| `vocab` | Trích từ bằng AI, kho từ cá nhân | `VocabEntry` | `/vocab` | `/vocab`, `/vocab/extract` |
| `flashcard` | Bộ thẻ, lịch ôn SM-2, bài tập AI | `Deck`, `Card`, `ReviewLog` | `/flashcards` | `/flashcards`, `/flashcards/[deckId]`, `.../review`, `.../practice` |
| `stats` | Tổng hợp số liệu (chỉ đọc) | (không có bảng) | `/stats` | `/stats` |

Trang `/` (landing) và `/home` (trang chủ sau đăng nhập) thuộc phần khung của `core`. Nội dung của `/home` do các module góp vào qua widget (B4).

## B2. Đồ thị phụ thuộc

```
                 ┌────────┐
                 │  core  │  ◀── mọi module đều được dùng core
                 └────────┘
   auth      content ◀──── exam ◀──┐
                ▲            ▲     │
                │            │     │
                └── vocab ───┘     │        (vocab dùng content để lấy bài đọc,
                      ▲            │         dùng exam để kiểm tra đã nộp bài)
                      │            │
                  flashcard        │
                      ▲            │
                      └─── stats ──┘        (stats chỉ đọc từ exam, vocab, flashcard)
```

**Luật:**
- Mũi tên A ◀── B nghĩa là B được gọi public API của A. Đồ thị **không có vòng**.
- **Module ở dưới không bao giờ biết module ở trên.** Ví dụ: `content` không biết `exam` tồn tại, `vocab` không biết `flashcard` tồn tại.
- Khi module dưới cần hiển thị dữ liệu của module trên (ví dụ trang kho từ cần trạng thái "đã thuộc" của flashcard), **client tự ghép** bằng cách gọi API của cả hai. Server không tạo phụ thuộc ngược.
- Liên kết giữa các trang của các module khác nhau dùng **URL + query** (ví dụ `/vocab/extract?source=test&testId=…&section=…`), không import component của nhau.

## B3. Hợp đồng module

Mỗi module **phải** tuân theo hợp đồng sau. Nhờ đó, thêm module mới chỉ là thêm một thư mục và đăng ký một dòng.

### Phía server — mỗi module xuất ra một "module definition"

| Thành phần | Nội dung |
|---|---|
| `name` | Tên module, ví dụ `vocab` |
| `basePath` | Prefix API duy nhất, ví dụ `/vocab`. Khi mount thành `/api/v1/vocab` |
| `router` | Express router chứa các endpoint của module |
| `registerDocs(registry)` | Đăng ký mọi endpoint và schema của module vào Swagger registry |
| `publicApi` | Các hàm mà **module khác** được gọi. Đây là cửa duy nhất để vào module |

- `core` có một danh sách module được bật. Lúc khởi động, app duyệt danh sách để mount router và đăng ký doc.
- Bên trong module chia tầng `routes → service → (core: db, ai)` như mô tả trong Project_Structure.
- **Không** import file nội bộ của module khác, chỉ import `publicApi` của nó.
- **Không** đọc hay ghi bảng thuộc sở hữu của module khác. Muốn dữ liệu thì gọi `publicApi`.

### Phía client — mỗi module là một "feature"

| Thành phần | Nội dung |
|---|---|
| API | Các hàm gọi endpoint của module, dùng API client chung của `core` |
| Components, hooks | Giao diện và logic hiển thị của module |
| `navItem` (nếu có) | Mục menu module góp vào navbar |
| `homeWidgets` (nếu có) | Widget module góp vào trang `/home` |
| `index` | Điểm export công khai duy nhất của feature |

- Các file trang trong `app/` chỉ **ghép** component lấy từ feature tương ứng, không chứa logic.
- Feature **không** import feature khác. Cần liên kết thì dùng URL.

### Phía shared — mỗi module có một thư mục

Chứa Zod schema của request/response, kiểu TypeScript và hằng số của module. Cả server (validate + Swagger) lẫn client (gọi API có kiểu) cùng dùng. `shared/core` chứa định dạng lỗi chuẩn, kiểu phân trang và các hằng số dùng chung.

### Database — mỗi module một file schema

Prisma schema tách **mỗi module một file `.prisma`**, dùng tính năng multi-file schema của Prisma. Nếu phiên bản Prisma được chọn chưa hỗ trợ ổn định tính năng này, dùng một file duy nhất nhưng chia section rõ ràng theo module, mỗi section do một module sở hữu. Quan hệ (foreign key) sang bảng của module khác được phép, nhưng chỉ module sở hữu bảng mới được ghi vào bảng đó.

## B4. Điểm mở rộng

Các chỗ dự kiến sẽ được thêm chức năng đều được thiết kế dạng **registry**: thêm chức năng = thêm một mục, không sửa code cũ.

| Registry | Thuộc module | Một mục gồm | Ví dụ mở rộng sau này |
|---|---|---|---|
| **Module registry** (server) | core | Module definition (B3) | Module `writing`, `speaking` |
| **Nav registry** (client) | core | Nhãn, icon, đường dẫn, thứ tự | Thêm menu cho module mới |
| **Home widget registry** (client) | core | Tiêu đề, component, thứ tự | Widget "từ của ngày" |
| **Question type registry** | exam (+ shared) | Schema đáp án, hàm chuẩn hóa & chấm (shared), component hiển thị (client) | Dạng `diagram-label`, `flowchart` |
| **Band table registry** | exam (shared) | Kỹ năng/loại đề → bảng quy đổi | General Training Reading |
| **Extraction source registry** | vocab | Loại nguồn → hàm lấy văn bản + tiêu đề | Nguồn `url`, `youtube-transcript` |
| **Scheduler strategy** | flashcard | Hàm tính lịch ôn từ thẻ + rating | Thay SM-2 bằng FSRS |
| **Exercise type registry** | flashcard | Prompt, schema output, component hiển thị | Bài điền từ, bài nối từ |
| **AI task registry** | core | Tên task, file prompt + phiên bản, schema output | Chấm Writing |
| **Stats widget registry** (client) | stats | Tiêu đề, endpoint dữ liệu, component biểu đồ | Heatmap hoạt động |

## B5. Quy tắc chống xung đột khi phát triển song song

1. **Mỗi PR chỉ chạm vào một module** (cộng thêm `shared/<module>` của module đó). PR cần sửa `core` thì tách thành PR riêng, merge trước.
2. **API trước, giao diện sau.** PR server của một endpoint merge trước PR client dùng endpoint đó. Bản preview của client gọi API production, nên endpoint phải có sẵn trên production.
3. **Migration chỉ thêm, không phá:** chỉ thêm bảng, thêm cột (cho phép null hoặc có giá trị mặc định). Muốn đổi tên hay xóa cột thì chia hai lần merge: thêm cái mới → chuyển code → xóa cái cũ. Tên migration bắt đầu bằng tên module, ví dụ `vocab_add_source_test_id`.
4. **Hai PR cùng tạo migration:** PR merge sau phải cập nhật branch theo `main` rồi tạo lại migration trước khi merge.
5. **File đăng ký dùng chung** (danh sách module, nav, widget): mỗi module chỉ thêm **đúng một dòng** của mình, nên xung đột nếu có cũng dễ giải quyết.
6. **Giao diện dùng chung** (theme, component `ui` của shadcn) thuộc `core`. Feature không tự định nghĩa màu hay component nền riêng.
7. **Hằng số nghiệp vụ** (giới hạn thẻ/ngày, thời lượng thi…) nằm trong `shared` của module sở hữu, không viết cứng ở client.

---

# Phần C — Đặc tả module

Quy ước chung cho mọi endpoint:
- Prefix `/api/v1`.
- Cần JWT, trừ khi ghi **(công khai)**.
- Lỗi trả về theo định dạng chuẩn trong Working_rules mục 8.3.
- Mọi endpoint đều có trong Swagger.

## C0. Module `core`

### Server
| Thành phần | Yêu cầu |
|---|---|
| Cấu hình | Đọc biến môi trường và validate bằng Zod lúc khởi động. Thiếu hay sai thì dừng ngay, kèm thông báo rõ biến nào |
| Lỗi | Class lỗi chuẩn (`code`, `status`, `message`). Middleware chuyển mọi lỗi (của dự án, của Zod, lỗi không lường trước) về định dạng chuẩn. Lỗi 500 không lộ chi tiết, chỉ ghi log ở server |
| Validate | Middleware validate `body` / `query` / `params` theo Zod schema |
| Bảo mật | `helmet`, CORS chỉ cho tên miền front-end (và preview của Vercel), giới hạn tần suất chung (300 request / 15 phút / IP), giới hạn kích thước body JSON (1 MB) |
| JWT | Hàm ký / xác minh token (HS256, hạn `JWT_EXPIRES_IN`). Middleware `requireAuth` gắn `userId` vào request |
| DB | Một Prisma Client dùng chung |
| AI gateway | `runJsonTask(task, input)`: lấy prompt theo task + phiên bản → bọc dữ liệu người dùng trong vùng phân cách → gọi Gemini yêu cầu trả JSON → validate bằng Zod → thử lại 1 lần nếu sai → ghi cache (`AiCache`, key = hash của task + phiên bản prompt + model + input) → đếm lượt dùng (`AiUsage`, giới hạn `AI_DAILY_LIMIT` mỗi người mỗi ngày, theo giờ Việt Nam). Có bản mock cho test |
| Swagger | Registry chung; app sinh đặc tả OpenAPI 3 lúc chạy; Swagger UI tại `/docs`, file đặc tả tại `/docs/openapi.json`; khai báo `bearerAuth` |
| Nạp module | Duyệt danh sách module được bật → mount router tại `/api/v1<basePath>` → gọi `registerDocs` |
| Health | `GET /api/v1/health` **(công khai)** → `{ status: "ok", version, time }`. Dùng cho UptimeRobot |
| Log | Mỗi request ghi một dòng gồm method, path, status, thời gian xử lý. Không ghi body, không ghi token |

**Bảng dữ liệu:** `AiUsage(userId, day, task, count)` với khóa `(userId, day, task)`; `AiCache(key, task, result JSON, createdAt)`.

### Client
| Thành phần | Yêu cầu |
|---|---|
| Theme | Màu, font, bo góc, đổ bóng khai báo bằng CSS variables theo theme của shadcn. Màu chủ đạo lấy từ prototype: nền `#F5F6F8`, chữ `#111827`, nhấn `#1D4ED8`, highlight `#FDE68A`, đúng `#15803D`, sai `#B91C1C`. Font Be Vietnam Pro |
| Component nền | Cài các component shadcn: button, input, textarea, select, label, card, tabs, dialog, alert-dialog, dropdown-menu, toast/sonner, progress, badge, skeleton, tooltip, checkbox, radio-group, table |
| Layout | 3 nhóm: **công khai** (landing, đăng nhập); **ứng dụng** (navbar từ nav registry, cần đăng nhập); **phòng thi** (toàn màn hình, không navbar) |
| API client | Gắn JWT; parse lỗi chuẩn thành lỗi có kiểu; gặp 401 thì xóa phiên và chuyển về `/login?next=…`; báo lỗi mạng bằng thông báo tiếng Việt |
| Phiên đăng nhập | Lưu token; context cung cấp `user`, `login`, `logout`, `refreshUser` |
| Trạng thái chung | Trang 404, trang lỗi, skeleton khi tải, mẫu "trạng thái trống", toast thông báo |
| Trang `/` | Landing: giới thiệu vòng học, 4 tính năng, nút Đăng nhập / Đăng ký |
| Trang `/home` | Lời chào + các widget từ home widget registry |
| Định dạng | Ngày giờ theo `vi-VN`, đồng hồ dạng `mm:ss`, số band 1 chữ số thập phân |

### Tiêu chí hoàn thành
- Server không khởi động khi thiếu biến môi trường.
- `/docs` hiển thị đủ mọi endpoint.
- Test route-coverage báo lỗi nếu có route chưa đăng ký doc.
- Lỗi nào cũng trả về đúng định dạng chuẩn.
- Gọi AI quá giới hạn thì nhận `429 RESOURCE_EXHAUSTED`.

## C1. Module `auth`

**Dữ liệu:** `User(id, email unique, passwordHash, name, targetBand Float?, createdAt, updatedAt)`. Email lưu dạng chữ thường.

| Method | Endpoint | Request | Response | Lỗi |
|---|---|---|---|---|
| POST | `/auth/register` (công khai) | `{ email, password (≥ 8 ký tự), name }` | `201 { user, accessToken }` | 400; 409 `ALREADY_EXISTS` |
| POST | `/auth/login` (công khai) | `{ email, password }` | `200 { user, accessToken }` | 400; 401 (thông báo chung, không tiết lộ email có tồn tại hay không) |
| GET | `/auth/me` | — | `200 { user }` | 401 |
| PATCH | `/auth/me` | `{ name?, targetBand? (4.0–9.0, bước 0.5) }` | `200 { user }` | 400 |

**Quy tắc:**
- Mật khẩu hash bằng bcrypt (cost 10). `user` trả về không bao giờ chứa `passwordHash`.
- Giới hạn đăng nhập/đăng ký: 10 lần / 15 phút / IP.
- Đăng xuất làm ở phía client: xóa token.

**Public API:** `getUserById(id)`.

**Giao diện:**
- `/login`, `/register`: form có label, báo lỗi từng trường, nút có trạng thái đang xử lý. Thành công thì chuyển tới `next` hoặc `/home`.
- `/profile`: sửa tên và band mục tiêu.

**Seed:** một tài khoản demo. Email và mật khẩu ghi trong file seed, không ghi trong tài liệu.

**Test:**
- Đăng ký trùng email.
- Đăng nhập sai mật khẩu.
- Gọi `/me` không có token / token hết hạn.
- PATCH với band không hợp lệ.

**Hoàn thành khi:** đăng ký → đăng nhập → refresh trang vẫn giữ phiên → sửa hồ sơ → đăng xuất, đều chạy được trên production.

## C2. Module `content`

**Dữ liệu:**
- `Test(id, slug unique, skill READING|LISTENING, title, description?, durationSec, source, isPublished, version, createdAt, updatedAt)`
- `Section(id, testId, order, title, text?, audioKey?, audioDurationSec?, transcript?)`
- `QuestionGroup(id, sectionId, order, type, instruction, options JSON?, maxWords?)`
- `Question(id, testId, groupId, number, prompt, options JSON?, answers String[], evidence, explanation?)`

Có chỉ mục (index) trên `(testId, number)`.

| Method | Endpoint | Response | Ghi chú |
|---|---|---|---|
| GET | `/tests?skill=&pageSize=&pageToken=` | `{ tests: [{ id, slug, skill, title, durationSec, questionCount, sectionCount }], nextPageToken }` | Chỉ trả đề `isPublished` |
| GET | `/tests/:id` | `{ id, skill, title, description, durationSec, source, sections: [{ order, title }], questionCount }` | Dùng cho trang giới thiệu đề. **Không** kèm nội dung câu hỏi |

**Public API** (cho `exam`, `vocab`):

| Hàm | Trả về |
|---|---|
| `getTestForCandidate(testId)` | Đề để làm bài: các section (text, audio URL, thời lượng audio), nhóm câu hỏi, câu hỏi. **Không** có `answers`, `evidence`, `explanation`, `transcript` |
| `getAnswerKey(testId)` | Đáp án + bằng chứng + giải thích + loại câu của từng câu, dùng để chấm |
| `getSectionText(testId, order, { includeTranscript })` | Văn bản của một section (bài đọc hoặc transcript) kèm tiêu đề |
| `getTestSummary(testId)` | Tiêu đề, kỹ năng, tổng số câu |

**Nhập đề (lệnh `content:import`):**
1. Đọc mọi file JSON trong `content/tests/`.
2. Validate bằng schema dùng chung. Báo lỗi rõ ràng kèm tên file, đường dẫn trường và lý do.
3. Kiểm tra thêm:
   - Số câu liên tục từ 1 tới N, không trùng.
   - `evidence` phải tìm thấy trong `text` hoặc `transcript` của section đó.
   - Đáp án của `mcq` / `matching` phải nằm trong `options`.
   - Đề Listening có `audio` và `audioDurationSec` cho mọi section.
4. Upsert theo `slug`. Nội dung thay đổi thì tăng `version`.
5. Đề đã có người làm thì không xóa. Gỡ đề thì đặt `isPublished = false`.

Lệnh `content:check` chạy bước 1–3 mà không ghi DB, và chạy trong CI.

**Audio:** `audioKey` là tên file trên R2. URL phát = `R2_PUBLIC_URL` + `audioKey`.

**Giao diện:**
- `/tests`: tab Reading / Listening; thẻ đề gồm tiêu đề, số câu, thời lượng, dạng câu; có trạng thái trống và skeleton.
- `/tests/[testId]`: tên đề, thời lượng, quy định phòng thi (Listening: audio phát một lần, không tua…), nút **Bắt đầu**. Có bài đang làm dở thì đổi thành **Tiếp tục làm bài**.

**Test:**
- Schema bắt được từng loại lỗi của file đề.
- Import chạy lại 2 lần không tạo bản ghi trùng.
- Payload cho thí sinh không chứa đáp án (test kiểm tra không có khóa `answers`, `evidence`).

**Hoàn thành khi:** 4 file đề qua `content:check`, import lên production, thư viện hiển thị đủ.

## C3. Module `exam`

**Dữ liệu:**
- `Attempt(id, userId, testId, testVersion, status IN_PROGRESS|SUBMITTED, startedAt, deadlineAt, submittedAt?, answers JSON, annotations JSON, flags Int[], rawScore?, totalQuestions?, band?, updatedAt)`
- `AttemptAnswer(id, attemptId, questionId, number, questionType, given, isCorrect)`: ghi lúc nộp bài, phục vụ thống kê.

Có index trên `(userId, status)` và `(userId, submittedAt)`.

| Method | Endpoint | Request | Response | Lỗi |
|---|---|---|---|---|
| POST | `/attempts` | `{ testId }` | `201 { attemptId }`. Nếu đã có bài dở của đề này thì `200` cùng `attemptId` cũ | 404 đề |
| GET | `/attempts?status=&testId=` | — | Lịch sử bài làm của người dùng | — |
| GET | `/attempts/:id` | — | `{ attempt: { id, status, startedAt, deadlineAt, answers, annotations, flags }, test: <getTestForCandidate>, serverNow }` | 403, 404 |
| PUT | `/attempts/:id/state` | `{ answers?, annotations?, flags? }` | `200 { savedAt }` | 409 `FAILED_PRECONDITION` nếu đã nộp hoặc đã quá `deadlineAt` + 10 giây |
| POST | `/attempts/:id/submit` | — | `200 { rawScore, totalQuestions, band }`. Nộp lại bài đã nộp thì trả kết quả cũ | 403 |
| GET | `/attempts/:id/result` | — | `{ summary, questions: [{ number, type, prompt, given, correctAnswers, isCorrect, evidence, explanation }], sections: [{ order, title, text?, transcript? }] }` | 409 nếu chưa nộp |

**Quy tắc nghiệp vụ:**
- **Thời gian:** `deadlineAt = startedAt + durationSec`. Client đếm ngược theo `deadlineAt − serverNow`, không theo đồng hồ máy.
- **Hết giờ:** client tự nộp bài. Nếu người dùng đóng tab, lần `GET` tiếp theo mà đã quá hạn thì server tự nộp với đáp án đã lưu (nộp "lười").
- **Listening theo dòng thời gian của server:**
  - Audio các section nối tiếp nhau từ lúc `startedAt`. Vị trí đang phát = `serverNow − startedAt`, quy ra section và giây tương ứng.
  - Refresh trang thì audio phát tiếp đúng thời điểm "đang diễn ra", giống thi thật (không thể dừng hay tua).
  - Hết audio thì sang **2 phút kiểm tra lại**. `durationSec` của đề Listening = tổng thời lượng audio + 120.
- **Annotation:** `{ sectionOrder, start, end, kind: "highlight" }`, với `start` / `end` là vị trí ký tự (offset) trong `text` của section.
- **Chấm điểm** dùng question type registry trong shared:
  - Chuẩn hóa đáp án: Unicode NFKC, chữ thường, cắt khoảng trắng hai đầu, gộp khoảng trắng thừa, bỏ dấu `.` `,` ở cuối.
  - `tfng` / `ynng`: so khớp chính xác với TRUE / FALSE / NOT GIVEN (hoặc YES / NO / NOT GIVEN).
  - `mcq`, `matching`: so khớp chữ cái.
  - `gap`: khớp một trong `answers` sau khi chuẩn hóa. Vượt `maxWords` thì tính sai.
  - `mcq-multi` (nhóm k câu dùng chung đáp án): đáp án lưu theo nhóm; điểm = số chữ cái chọn đúng, tối đa k; mỗi số câu tính một điểm.
- **Band:**
  - Quy đổi về thang 40: `scaled = round(raw / total × 40)`. Đề đủ 40 câu thì `scaled = raw`.
  - Tra bảng tương ứng: Academic Reading hoặc Listening.
  - Hiển thị kèm chữ "ước tính".
- **Bảo mật:** chỉ chủ bài làm mới đọc hay ghi được. Không trả đáp án trước khi nộp.

**Public API** (cho `vocab`, `stats`):
- `hasSubmitted(userId, testId)`
- `getScoreHistory(userId, skill?)`
- `getWrongRateByType(userId)`
- `getActivityDays(userId, days)`
- `getInProgress(userId)`

**Giao diện — phòng thi `/attempts/[id]`** (layout phòng thi):

| Vùng | Chi tiết |
|---|---|
| Header | Tên đề; đồng hồ (Reading: thời gian còn lại; Listening: trạng thái audio, rồi thời gian kiểm tra lại); cảnh báo khi còn 10 phút và 1 phút; nút **Nộp bài** mở hộp xác nhận báo số câu chưa làm |
| Thanh công cụ | Reading: **Highlight** (bôi đen rồi bấm), **Xóa highlight**. Cả hai kỹ năng: hướng dẫn ngắn. Chỉ báo lưu bài "Đã lưu / Đang lưu / Mất kết nối" |
| Khung trái | Reading: bài đọc chia đoạn có nhãn A, B, C…, tô highlight. Listening: trình phát không tua (chỉ có âm lượng), thanh tiến độ, tên Part đang phát, danh sách quy định |
| Khung phải | Câu hỏi theo nhóm, hướng dẫn của nhóm; component lấy từ question type registry; nút cờ đánh dấu; nút gạch bỏ phương án |
| Thanh dưới | Tab Part / Passage; các ô số câu (đã làm / chưa làm / đã đánh dấu); nút câu trước / câu sau; bấm ô số thì cuộn tới câu |
| Hành vi | Tự lưu sau 800 ms ngừng thao tác, khi rời ô nhập và khi đổi tab trình duyệt; lỗi mạng thì thử lại với thời gian chờ tăng dần; hỏi xác nhận khi rời trang lúc chưa nộp; màn hình hẹp thì hai khung xếp dọc |

**Giao diện — kết quả `/attempts/[id]/result`:**
- Thẻ điểm (đúng/tổng), band ước tính, thời gian làm bài.
- Danh sách câu: lọc Tất cả / Sai; mỗi câu có câu trả lời, đáp án, bằng chứng.
- Bấm **"Xem trong bài"** để cuộn tới đoạn chứa bằng chứng và tô sáng.
- Listening: transcript, và nghe lại được (lúc này cho phép tua).
- Nút hành động:
  - **Trích từ vựng từ bài này**: dẫn tới `/vocab/extract?source=test&testId=…&section=…`.
  - **Làm lại**.
  - **Về thư viện**.

**Test:**
- Unit cho từng dạng câu: chuẩn hóa, chấm, `maxWords`, `mcq-multi` bất kể thứ tự.
- Unit cho bảng band.
- API test:
  - Resume bài dở.
  - Autosave sau hạn bị từ chối.
  - Nộp hai lần không đổi kết quả.
  - Người khác truy cập bị 403.
  - Nộp lười khi quá hạn.
- E2E: làm hết một đề Reading và nộp.

**Hoàn thành khi:**
- Làm trọn 1 đề Reading và 1 đề Listening trên production.
- Refresh giữa chừng không mất đáp án, highlight hay thời gian; audio phát tiếp đúng vị trí.
- Nộp bài ra kết quả có bằng chứng.

## C4. Module `vocab`

**Dữ liệu:** `VocabEntry(id, userId, headword, lemma, pos, ipa, cefr B1|B2|C1|C2, meaningVi, meaningEn, example, collocations String[], sourceKind TEXT|FILE|TEST, sourceTestId?, sourceTitle, createdAt, updatedAt)`, unique `(userId, lemma, pos)`.

| Method | Endpoint | Request | Response | Lỗi |
|---|---|---|---|---|
| POST | `/vocab/extractions` | JSON `{ source: { kind: "text", text, title? } \| { kind: "test", testId, section }, targetLevel: B2\|C1\|C2, limit? (≤ 30, mặc định 15) }`, hoặc multipart `file` + `targetLevel` | `200 { sourceTitle, candidates: [{ headword, lemma, pos, ipa, cefr, meaningVi, meaningEn, example, collocations, alreadySaved }] }` | 400 (rỗng, quá 5.000 từ); 403 (transcript khi chưa nộp bài); 413 (file > 4 MB); 415 (sai loại file); 429; 503 `UNAVAILABLE` (AI lỗi) |
| POST | `/vocab` | `{ entries: [...], source: { kind, testId?, title } }` | `201 { savedCount, skippedDuplicates }` | 400 |
| GET | `/vocab?q=&cefr=&sourceTestId=&pageSize=&pageToken=` | — | `{ entries, nextPageToken }` | — |
| GET / PATCH / DELETE | `/vocab/:id` | PATCH: `{ meaningVi?, meaningEn?, example?, collocations? }` | `200` / `200` / `204` | 403, 404 |

**Quy trình trích xuất:**
1. **Nguồn → văn bản** qua extraction source registry:
   - `text`: lấy trực tiếp.
   - `file`: PDF qua thư viện đọc PDF, DOCX qua thư viện đọc DOCX, TXT đọc UTF-8. Kiểm tra cả MIME lẫn đuôi file, chỉ xử lý trong bộ nhớ.
   - `test`: lấy qua `content.getSectionText`. Transcript chỉ được lấy khi `exam.hasSubmitted` trả về đúng.
2. **Chuẩn hóa:** gộp khoảng trắng; đếm từ; quá 5.000 từ thì báo lỗi.
3. **Chia đoạn:** mỗi đoạn khoảng 1.500 từ, cắt theo ranh giới đoạn văn.
4. **Gọi AI:** mỗi đoạn một lệnh `core.ai.runJsonTask("extract-vocab", …)`, tối đa 2 lệnh song song.
5. **Hậu kiểm:**
   - `example` phải xuất hiện trong văn bản gốc (không phân biệt hoa thường, sau khi gộp khoảng trắng). Không tìm thấy thì loại.
   - Gộp trùng theo `lemma + pos`.
   - Bỏ từ thấp hơn `targetLevel`.
   - Đánh dấu `alreadySaved` cho từ đã có trong kho.
   - Cắt theo `limit`.
6. Trả về danh sách **ứng viên**. Chưa lưu gì cho tới khi người dùng chọn và bấm lưu.

**Prompt `extract-vocab.v1`:**
- **Đầu vào:** văn bản (bọc trong vùng phân cách, ghi chú rằng đó là dữ liệu chứ không phải chỉ dẫn), trình độ mục tiêu, số lượng.
- **Đầu ra:** mảng JSON đúng schema.
- **Yêu cầu:**
  - Chọn từ hoặc cụm từ học thuật từ trình độ mục tiêu trở lên.
  - Trả về dạng gốc (lemma).
  - IPA kiểu Anh–Anh.
  - Nghĩa tiếng Việt ngắn gọn theo **đúng ngữ cảnh** của bài.
  - `example` là đoạn **chép nguyên văn** từ bài có chứa từ đó.
  - 2–3 collocation thông dụng.
  - Không bịa từ không có trong bài.

**Public API** (cho `flashcard`, `stats`):
- `getEntriesByIds(userId, ids)`
- `assertOwnership(userId, ids)`
- `countAddedByWeek(userId, weeks)`
- `countTotal(userId)`

**Giao diện:**
- `/vocab/extract`:
  - **Nguồn:** tab "Dán văn bản" / "Tải file"; nếu URL có `source=test` thì hiện sẵn khung "Từ bài thi: <tên đề – Part>".
  - **Thiết lập:** chọn trình độ mục tiêu.
  - **Trích xuất:** nút **Trích xuất**, có trạng thái đang xử lý (có thể mất 10–20 giây).
  - **Chọn và lưu:** danh sách ứng viên dạng thẻ có checkbox ("Chọn tất cả", từ đã có trong kho hiện mờ, kèm nhãn "Đã có"); nút **Lưu N từ**. Lưu xong thì có toast kèm nút **Tạo bộ thẻ từ các từ này**, dẫn tới `/flashcards?create=1&vocabIds=…`.
- `/vocab` (kho từ):
  - Tìm kiếm, lọc theo trình độ và nguồn.
  - Thẻ từ có nhãn trạng thái Mới / Đang học / Đã thuộc. Client lấy trạng thái từ API của flashcard.
  - Xóa có hộp xác nhận; chọn nhiều từ để tạo bộ thẻ.

**Test:**
- Unit:
  - Đọc từng loại file (dùng file mẫu nhỏ).
  - Chia đoạn.
  - Hậu kiểm: loại `example` bịa, gộp trùng, lọc theo trình độ.
- API: trích xuất với AI giả lập; vượt quota; file sai loại.

**Hoàn thành khi:**
- Dán bài khoảng 800 từ → trong khoảng 20 giây ra ≥ 10 từ đủ thông tin.
- Lưu được, kho từ hiển thị đúng.
- Từ trang kết quả bài thi, một nút bấm trích được từ của passage đó.

## C5. Module `flashcard`

**Dữ liệu:**
- `Deck(id, userId, name, description?, createdAt, updatedAt)`
- `Card(id, deckId, vocabId, state NEW|LEARNING|REVIEW, easeFactor 2.5, intervalDays 0, repetitions 0, lapses 0, dueAt, lastReviewedAt?)`, unique `(deckId, vocabId)`
- `ReviewLog(id, cardId, userId, rating, reviewedAt, intervalBefore, intervalAfter, easeBefore, easeAfter)`

Có index trên `(deckId, dueAt)` và `(userId, reviewedAt)`.

| Method | Endpoint | Request | Response |
|---|---|---|---|
| GET | `/flashcards/decks` | — | `[{ id, name, cardCount, dueCount, newCount }]` |
| POST | `/flashcards/decks` | `{ name, description?, vocabIds[] }` | `201 { deck }` |
| GET / PATCH / DELETE | `/flashcards/decks/:id` | PATCH: `{ name?, description? }` | Chi tiết kèm danh sách thẻ / `200` / `204` (xóa luôn thẻ) |
| POST | `/flashcards/decks/:id/cards` | `{ vocabIds[] }` | `201 { addedCount, skippedDuplicates }` |
| DELETE | `/flashcards/decks/:id/cards/:cardId` | — | `204` |
| GET | `/flashcards/decks/:id/session` | — | `{ cards: [{ cardId, state, vocab }], remainingNewToday, remainingReviewsToday }` |
| POST | `/flashcards/cards/:id/reviews` | `{ rating: "again"\|"hard"\|"good"\|"easy" }` | `200 { card: { state, intervalDays, dueAt } }` |
| POST | `/flashcards/decks/:id/exercises` | `{ type: "mcq", count (5–20) }` | `200 { questions: [{ vocabId, prompt, options[4], answerIndex }] }` |
| GET | `/flashcards/vocab-status?vocabIds=` | — | `{ [vocabId]: "NEW"\|"LEARNING"\|"MASTERED" }` |

Mọi lỗi 403 / 404 theo quyền sở hữu. `vocabIds` được kiểm tra qua `vocab.assertOwnership`.

**Thuật toán SM-2** (scheduler strategy mặc định; EF = ease factor, tối thiểu 1.3):

| Rating | EF | Khoảng cách (interval) | Khác |
|---|---|---|---|
| again | EF − 0.20 | 0; đến hạn sau **10 phút** | repetitions = 0, lapses + 1, state = LEARNING |
| hard | EF − 0.15 | repetitions = 0 → 1 ngày; còn lại → max(1, round(interval × 1.2)) | repetitions + 1 |
| good | giữ nguyên | repetitions = 0 → 1; = 1 → 6; còn lại → round(interval × EF) | repetitions + 1 |
| easy | EF + 0.15 | repetitions = 0 → 4; còn lại → round(interval × EF × 1.3) | repetitions + 1 |

- `dueAt = now + interval ngày`. `state = REVIEW` khi interval ≥ 1.
- **Trạng thái của từ:**
  - MASTERED: có thẻ với interval ≥ 21 ngày.
  - LEARNING: có thẻ đã được ôn.
  - NEW: chưa có thẻ, hoặc có thẻ nhưng chưa ôn.
- **Phiên ôn:** gồm thẻ đến hạn (tối đa số lượt ôn còn lại trong ngày, `REVIEWS_PER_DAY = 100`) cộng thẻ mới (tối đa `NEW_CARDS_PER_DAY = 20`). Đếm theo ngày giờ Việt Nam.
- **Bài tập AI** (`generate-exercise.v1`): sinh câu hỏi trắc nghiệm nghĩa/ngữ cảnh từ các từ trong deck. Validate: đủ 4 phương án, không trùng nhau, `answerIndex` hợp lệ, mỗi câu gắn đúng một `vocabId` của deck. Kết quả không lưu, chấm ngay ở client.

**Public API** (cho `stats`): `getDueCount(userId)`, `getReviewCountByDay(userId, days)`, `getMasteredCount(userId)`.

**Giao diện:**
- `/flashcards`:
  - Danh sách deck (số thẻ, số thẻ đến hạn, số thẻ mới), nút **Ôn ngay**.
  - Hộp tạo deck. Mở sẵn khi URL có `create=1&vocabIds=…`.
- `/flashcards/[deckId]`: thông tin deck, danh sách thẻ, thêm từ từ kho, gỡ thẻ, sửa tên, xóa deck.
- `/flashcards/[deckId]/review`:
  - Thẻ lật bằng hiệu ứng 3D. Mặt trước: từ, IPA, loại từ. Mặt sau: nghĩa, ví dụ, collocation.
  - 4 nút đánh giá, mỗi nút ghi rõ lần ôn tiếp theo.
  - Phím tắt: `Space` lật thẻ, `1`–`4` đánh giá.
  - Thanh tiến độ; màn hình tổng kết khi hết thẻ.
- `/flashcards/[deckId]/practice`: làm bài trắc nghiệm, chấm ngay, xem lại câu sai.

**Test:**
- Unit SM-2: đủ mọi rating, đủ các mốc repetitions, EF không dưới 1.3.
- Unit giới hạn mỗi ngày (gồm trường hợp qua nửa đêm giờ Việt Nam).
- API: phiên ôn; ôn thẻ của người khác bị 403; bài tập với AI giả lập.

**Hoàn thành khi:** tạo deck từ kết quả trích từ → ôn thẻ → đổi giờ hệ thống trong test thì thẻ đến hạn đúng lịch. Kho từ hiện đúng trạng thái.

## C6. Module `stats`

Không có bảng riêng. Chỉ đọc dữ liệu qua public API của `exam`, `vocab`, `flashcard`.

| Method | Endpoint | Response |
|---|---|---|
| GET | `/stats/overview` | `{ streakDays, totalVocab, masteredVocab, dueToday, lastBand: { reading?, listening? }, attemptsCount }` |
| GET | `/stats/scores?skill=` | `[{ attemptId, testTitle, submittedAt, band, rawScore, totalQuestions }]` |
| GET | `/stats/vocab-growth?weeks=8` | `[{ weekStart, added }]` |
| GET | `/stats/weakness` | `[{ questionType, label, attempted, wrongRate, enoughData }]`. `enoughData = attempted ≥ 5` |
| GET | `/stats/activity?days=30` | `[{ day, reviews, attempts }]` |

**Quy tắc:** chuỗi ngày học = số ngày liên tiếp tính tới hôm nay (giờ Việt Nam) có ít nhất 1 lượt ôn thẻ hoặc 1 bài nộp.

**Giao diện `/stats`:** stats widget registry gồm:
- Thẻ tổng quan.
- Biểu đồ đường band theo thời gian, tách Reading / Listening.
- Biểu đồ cột số từ mới theo tuần.
- Thanh ngang tỉ lệ sai theo dạng câu. Chưa đủ dữ liệu thì hiện "chưa đủ dữ liệu".
- Bảng các bài làm gần đây.

Mỗi biểu đồ có tiêu đề, mô tả ngắn, `aria-label` tóm tắt số liệu, và trạng thái trống.

**Widget trang chủ** (các module góp vào `/home`):
- `exam`: "Tiếp tục bài đang làm", "Band gần nhất".
- `flashcard`: "N thẻ đến hạn hôm nay".
- `stats`: "Chuỗi ngày học".
- `vocab`: "Trích từ vựng mới".

**Test:**
- Unit tính chuỗi ngày (có ngày trống, qua nửa đêm).
- API test với dữ liệu seed cho ra đúng con số.

**Hoàn thành khi:** tài khoản demo có ≥ 3 bài nộp và lịch sử ôn thẻ thì mọi biểu đồ hiện đúng số liệu, khớp với DB.

---

# Phần D — Kế hoạch theo giai đoạn

**Cách dùng:**
- Mỗi dòng là **một Issue = một PR**. Mã `Pn-xx` ghi vào đầu tiêu đề Issue để dễ tra cứu.
- Cột **Phụ trách** là người mở PR. Người còn lại review.
- Cột **Cỡ**: S ≈ dưới nửa ngày, M ≈ một ngày, L ≈ hơn một ngày (nên tách nhỏ khi làm).
- Cột **Cần trước** là các issue phải merge trước.
- Thứ tự trong bảng là thứ tự đề xuất. Các issue không phụ thuộc nhau thì hai người làm song song.

## Giai đoạn 0 — Chuẩn bị (T7 24/10 – CN 25/10)

**Mục tiêu:** repo có khung chạy được ở local, CI xanh, các tài khoản dịch vụ và tên miền sẵn sàng.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P0-01 | Tạo board GitHub Projects (5 cột), labels (`module:*`, `type:*`, `size:*`), milestones Giai đoạn 0–8 | quản lý | TV1 | S | — | Board có đủ cột; mọi issue Giai đoạn 0–1 đã được tạo |
| P0-02 | Thêm TV2 làm collaborator; bật bảo vệ `main` (bắt buộc PR, 1 approve, CI xanh, cấm force push) | quản lý | TV2 | S | — | Push thẳng `main` bị chặn |
| P0-03 | Đăng ký tên miền; chuyển DNS về Cloudflare | deploy | TV2 | S | — | Tên miền trỏ được về Cloudflare |
| P0-04 | Tạo tài khoản Vercel, Render, Neon (branch `main` + `dev`), Cloudflare R2, UptimeRobot; lấy Gemini API key | deploy | TV1 | S | — | Có đủ thông tin kết nối, lưu ở nơi an toàn của nhóm (không trong repo) |
| P0-05 | Khung monorepo: npm workspaces (`client`, `server`, `shared`), TypeScript, gts, `.editorconfig`, `.nvmrc`, `.gitignore`, script gốc (`dev`, `lint`, `fix`, `test`, `build`) | core | TV2 | M | P0-02 | `npm install` và `npm run lint` chạy được ở gốc |
| P0-06 | Khung client: Next.js App Router, Tailwind, shadcn init, theme tokens, font Be Vietnam Pro, 3 nhóm layout trống | core/client | TV1 | M | P0-05 | `npm run dev` hiện trang landing tạm |
| P0-07 | Khung server: Express app, validate biến môi trường, `GET /api/v1/health` | core/server | TV2 | S | P0-05 | Gọi health trả về `ok` |
| P0-08 | CI GitHub Actions: cài đặt, lint, kiểm tra kiểu, test, build cho cả 3 workspace; cache npm | core | TV1 | M | P0-06, P0-07 | PR mẫu chạy CI xanh |
| P0-09 | PR template, issue template (feature, bug), Discussions bật mục *Meetings* | quản lý | TV1 | S | — | Mở PR/Issue mới hiện đúng template |
| P0-10 | Soạn file đề `reading-01` (bản nháp đủ 40 câu) | content | TV2 | L | — | File nháp có đủ đáp án và bằng chứng |

## Giai đoạn 1 — Nền móng: core + auth + deploy (T2 26/10 – T4 28/10)

**Mục tiêu:** đăng ký / đăng nhập chạy trên tên miền thật; Swagger có mặt từ đầu; AI gateway sẵn sàng.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P1-01 | Lỗi chuẩn, middleware xử lý lỗi, middleware validate Zod, bọc handler async | core/server | TV2 | S | P0-07 | Lỗi Zod và lỗi không lường trước đều ra đúng định dạng chuẩn (có test) |
| P1-02 | Module registry + Swagger registry; Swagger UI `/docs`, `/docs/openapi.json`; test route-coverage | core/server | TV2 | M | P1-01 | `/docs` hiện health; thêm route chưa có doc thì test báo lỗi |
| P1-03 | Prisma: cài đặt, multi-file schema theo module, Prisma Client dùng chung, script `db:migrate`, `db:seed`; CI có Postgres cho API test | core/server | TV2 | M | P0-07 | Migration đầu tiên chạy được trên Neon `dev` và trong CI |
| P1-04 | Bảo mật: helmet, CORS, rate limit chung, giới hạn body; JWT ký/xác minh; middleware `requireAuth` | core/server | TV2 | S | P1-01 | Thiếu token thì 401 (có test) |
| P1-05 | Module auth (server): bảng `User`, 4 endpoint, rate limit đăng nhập, Swagger, test | auth | TV2 | M | P1-02, P1-03, P1-04 | Đạt các test của C1 |
| P1-06 | API client, lỗi có kiểu, phiên đăng nhập (context), bảo vệ trang cần đăng nhập | core/client | TV1 | M | P0-06 | Chưa đăng nhập vào `/home` thì bị chuyển về `/login?next=/home` |
| P1-07 | Khung giao diện: navbar từ nav registry, layout ứng dụng/phòng thi, toast, trang 404/lỗi, skeleton, trạng thái trống | core/client | TV1 | M | P0-06 | Các trang khung hiển thị đúng ở 375px và 1440px |
| P1-08 | Module auth (client): `/login`, `/register`, `/profile`, đăng xuất | auth | TV1 | M | P1-05, P1-06 | Đạt "Hoàn thành khi" của C1 ở local |
| P1-09 | Trang landing `/` theo prototype | core/client | TV1 | S | P1-07 | Responsive, nút dẫn tới đăng nhập / đăng ký |
| P1-10 | Deploy: server lên Render (chạy `migrate deploy` trước khi start), Neon `main`; client lên Vercel; `<tên-miền>` + `api.<tên-miền>` có HTTPS; biến môi trường production | deploy | TV2 | M | P1-05 | Đăng ký / đăng nhập được trên production |
| P1-11 | UptimeRobot cho web + `/api/v1/health`, trang status công khai; README thêm link web, `/docs`, status | deploy | TV1 | S | P1-10 | Trang status xanh |
| P1-12 | AI gateway: Gemini client, `runJsonTask`, AI task registry, bảng `AiCache` / `AiUsage`, quota, retry, bản mock cho test | core/server | TV2 | M | P1-03 | Test với mock: cache trúng, quá quota ra 429, JSON sai thì thử lại |

## Giai đoạn 2 — Module `vocab` (T4 28/10 – CN 01/11) → `v0.1`

**Mục tiêu:** trích từ bằng AI từ văn bản/file và lưu vào kho, chạy trên production.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P2-01 | Shared: schema & kiểu của vocab (ứng viên, entry, request, response) | vocab | TV2 | S | P0-05 | Server và client cùng import được |
| P2-02 | Server: bảng `VocabEntry`; endpoint `POST /vocab`, `GET /vocab`, `GET/PATCH/DELETE /vocab/:id`; Swagger; test quyền sở hữu | vocab | TV2 | M | P2-01, P1-05 | Đạt test; doc hiển thị đủ |
| P2-03 | Server: extraction source registry; nguồn `text` và `file` (PDF/DOCX/TXT, giới hạn 4 MB, kiểm tra MIME); test với file mẫu | vocab | TV2 | M | P2-01 | Đọc đúng chữ từ 3 loại file mẫu |
| P2-04 | Server: prompt `extract-vocab.v1`; quy trình chia đoạn → AI → hậu kiểm → `alreadySaved`; endpoint `POST /vocab/extractions`; test với mock | vocab | TV2 | L | P1-12, P2-02, P2-03 | Câu ví dụ bịa bị loại; trùng được gộp; quá quota ra 429 |
| P2-05 | Client: `/vocab/extract`, phần nguồn (dán / tải file), chọn trình độ, trạng thái đang xử lý & lỗi | vocab | TV1 | M | P2-04 | Gửi được cả văn bản lẫn file; lỗi hiện bằng tiếng Việt |
| P2-06 | Client: danh sách ứng viên (checkbox, chọn tất cả, nhãn "Đã có"), lưu, toast | vocab | TV1 | M | P2-05 | Lưu đúng các từ được chọn |
| P2-07 | Client: `/vocab` kho từ (tìm kiếm, lọc, xóa, phân trang), nav item, widget "Trích từ vựng mới" | vocab | TV1 | M | P2-02 | Đạt mô tả C4 (phần nhãn trạng thái làm ở P5-07) |
| P2-08 | Seed: tài khoản demo + một ít từ mẫu | vocab | TV1 | S | P2-02 | `db:seed` chạy lại được nhiều lần |
| P2-09 | Kiểm tra trên production, tag `v0.1`, release notes, ảnh chụp cho report | quản lý | TV1 | S | P2-06, P2-07 | Release có trên GitHub |
| P2-10 | Nội dung: hoàn thiện `reading-01`, soạn `reading-02` | content | TV2 | L | — | 2 file đủ 40 câu (sẽ được kiểm tra ở P3-02) |

## Giai đoạn 3 — Module `content` + `exam` (Reading) (T2 02/11 – T5 05/11)

**Mục tiêu:** làm và nộp được một đề Reading hoàn chỉnh.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P3-01 | Shared: schema file đề; question type registry (6 dạng: schema đáp án, chuẩn hóa, chấm); bảng band; unit test | content + exam | TV2 | M | P0-05 | Test chấm của mọi dạng câu đạt |
| P3-02 | Server content: 4 bảng; lệnh `content:import` & `content:check` (đủ các bước kiểm tra ở C2); thêm `content:check` vào CI; import `reading-01/02` | content | TV2 | M | P3-01, P1-03 | Lỗi của file đề được báo rõ ràng; import chạy lại không bị trùng |
| P3-03 | Server content: `GET /tests`, `GET /tests/:id`; public API; Swagger; test payload thí sinh không lộ đáp án | content | TV2 | S | P3-02 | Đạt test |
| P3-04 | Server exam: bảng `Attempt`; `POST /attempts` (tiếp tục bài dở), `GET /attempts/:id` (có `serverNow`, nộp lười), `PUT /attempts/:id/state` (từ chối khi quá hạn); Swagger; test | exam | TV2 | M | P3-03 | Đạt các API test liên quan ở C3 |
| P3-05 | Server exam: nộp bài, chấm điểm, band, `AttemptAnswer`, `GET /attempts/:id/result`, `GET /attempts`; test | exam | TV2 | M | P3-04 | Nộp hai lần không đổi kết quả; người khác truy cập bị 403 |
| P3-06 | Client content: `/tests` (tab, thẻ đề), `/tests/[testId]` (quy định, Bắt đầu / Tiếp tục), nav item | content | TV1 | M | P3-03 | Bấm Bắt đầu → tạo attempt → vào phòng thi |
| P3-07 | Client exam: khung phòng thi (header, đồng hồ theo giờ server, cảnh báo, hộp xác nhận nộp bài, thanh dưới, tab Part, cuộn tới câu), hook tự lưu + chỉ báo trạng thái lưu, hỏi xác nhận khi rời trang | exam | TV1 | L | P3-04 | Refresh không mất gì; mất mạng thì hiện "Mất kết nối" và tự lưu lại khi có mạng |
| P3-08 | Client exam: component cho 6 dạng câu (registry), gạch bỏ phương án, đánh dấu câu | exam | TV1 | M | P3-07 | Mọi dạng câu trong `reading-01` hiển thị và lưu được |
| P3-09 | Client exam: khung bài đọc (chia đoạn A, B, C…), highlight (bôi đen → offset → lưu → hiện lại), xóa highlight | exam | TV1 | M | P3-07 | Highlight còn nguyên sau khi refresh |
| P3-10 | Nội dung: TV1 review đáp án `reading-01/02`; TV2 soạn `listening-01` (kịch bản + đáp án) | content | TV1 + TV2 | M | P3-02 | Có comment review trong PR nội dung |

## Giai đoạn 4 — `exam` (Listening) + kết quả + vòng học (T5 05/11 – CN 08/11) → `v0.2`

**Mục tiêu:** làm được đề Listening; trang kết quả đầy đủ; nút "Trích từ vựng từ bài này" chạy được.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P4-01 | Nội dung: thu âm / tạo audio `listening-01/02`, upload R2, điền `audioDurationSec`, import lên production | content | TV2 | M | P3-02 | `content:check` đạt; audio phát được từ URL R2 |
| P4-02 | Server exam: dòng thời gian Listening (vị trí audio theo giờ server, giai đoạn kiểm tra lại) trong `GET /attempts/:id`; test | exam | TV2 | M | P3-04 | Test với thời gian giả lập trả về đúng section và giây |
| P4-03 | Client exam: khung Listening (trình phát không tua, âm lượng, tiến độ, tự phát tiếp đúng vị trí, đếm ngược 2 phút kiểm tra lại, tự nộp khi hết giờ) | exam | TV1 | L | P4-02 | Refresh khi đang nghe thì phát tiếp đúng vị trí |
| P4-04 | Client exam: trang kết quả (thẻ điểm, lọc câu sai, bằng chứng, "Xem trong bài" tô sáng, transcript, các nút hành động) | exam | TV1 | M | P3-05 | Đạt mô tả C3 |
| P4-05 | Server vocab: nguồn `test` (dùng `content.getSectionText`, transcript yêu cầu `exam.hasSubmitted`); test | vocab | TV2 | S | P2-04, P3-05 | Lấy transcript khi chưa nộp bài thì bị 403 |
| P4-06 | Client vocab: nhận `?source=test&testId&section`, hiện khung nguồn từ bài thi | vocab | TV1 | S | P4-05, P4-04 | Từ trang kết quả bấm nút → ra danh sách từ của passage |
| P4-07 | E2E Playwright: đăng nhập → làm đề Reading → nộp → kết quả → trích từ; chạy trong CI | core | TV1 | M | P4-06 | Test xanh trong CI |
| P4-08 | Widget trang chủ của exam ("Tiếp tục bài đang làm", "Band gần nhất") | exam | TV1 | S | P3-05 | Hiện đúng theo dữ liệu |
| P4-09 | Kiểm tra trên production, tag `v0.2`, release notes, ảnh chụp | quản lý | TV2 | S | P4-03 → P4-07 | Release có trên GitHub |

## Giai đoạn 5 — Module `flashcard` (T2 09/11 – T4 11/11)

**Mục tiêu:** tạo bộ thẻ từ kho từ, ôn theo lịch, làm bài trắc nghiệm.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P5-01 | Shared: schema & kiểu flashcard; hằng số giới hạn mỗi ngày | flashcard | TV2 | S | P0-05 | Server và client cùng import được |
| P5-02 | Server: 3 bảng; CRUD deck; thêm/gỡ thẻ (kiểm tra quyền qua `vocab.assertOwnership`); Swagger; test | flashcard | TV2 | M | P5-01, P2-02 | Đạt test quyền sở hữu |
| P5-03 | Server: scheduler strategy SM-2 (theo bảng C5); giới hạn mỗi ngày theo giờ Việt Nam; endpoint `session` và `reviews`; unit test đầy đủ | flashcard | TV2 | M | P5-02 | Đạt mọi unit test SM-2 |
| P5-04 | Server: `vocab-status`; exercise type registry + prompt `generate-exercise.v1` + endpoint `exercises`; test với mock | flashcard | TV2 | M | P5-02, P1-12 | Câu hỏi sai định dạng bị loại |
| P5-05 | Client: `/flashcards` (danh sách deck, tạo deck có điền sẵn `vocabIds`), `/flashcards/[deckId]` (chi tiết, thêm/gỡ thẻ), nav item, widget "thẻ đến hạn" | flashcard | TV1 | M | P5-02 | Tạo được deck từ toast sau khi lưu từ |
| P5-06 | Client: `/flashcards/[deckId]/review` (lật 3D, 4 nút, phím tắt, tiến độ, tổng kết) | flashcard | TV1 | M | P5-03 | Ôn hết phiên bằng bàn phím được |
| P5-07 | Client: `/flashcards/[deckId]/practice`; nhãn trạng thái trong kho từ (gọi `vocab-status`) | flashcard | TV1 | M | P5-04 | Kho từ hiện đúng Mới / Đang học / Đã thuộc |

## Giai đoạn 6 — Module `stats` + trang chủ (T4 11/11 – T6 13/11)

**Mục tiêu:** dashboard đủ số liệu; trang chủ có đủ widget.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P6-01 | Public API phục vụ thống kê của exam / vocab / flashcard (các hàm liệt kê ở C3, C4, C5) + test | exam, vocab, flashcard | TV2 | M | P3-05, P5-03 | Có test cho từng hàm |
| P6-02 | Server stats: 5 endpoint, tính chuỗi ngày; Swagger; test với dữ liệu seed | stats | TV2 | M | P6-01 | Đạt test |
| P6-03 | Client stats: stats widget registry + trang `/stats` (5 widget, `aria-label`, trạng thái trống), nav item | stats | TV1 | M | P6-02 | Đạt "Hoàn thành khi" của C6 |
| P6-04 | Client: trang `/home` ghép đủ widget của các module | core/client | TV1 | S | P6-03, P4-08, P5-05 | Đủ widget, mỗi widget có trạng thái trống |
| P6-05 | Seed lịch sử demo cho tài khoản demo (bài nộp, lượt ôn trải trên 4 tuần) | stats | TV1 | S | P6-02 | Dashboard tài khoản demo đầy đủ số liệu |

## Giai đoạn 7 — Đóng băng tính năng & hoàn thiện (T7 14/11 – CN 15/11) → `v1.0`

**Từ 14/11 không thêm tính năng mới.** Chỉ hoàn thiện, kiểm thử, sửa lỗi.

| Mã | Công việc | Phạm vi | Phụ trách | Cỡ | Cần trước | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| P7-01 | Rà a11y & responsive mọi trang (bàn phím, focus, tương phản, 375px), sửa lỗi | toàn client | TV1 | M | — | Không còn lỗi mức nghiêm trọng |
| P7-02 | Rà bảo mật: kiểm tra quyền sở hữu ở mọi endpoint, rate limit, giới hạn upload, header, không lộ đáp án; sửa lỗi | toàn server | TV2 | M | — | Có checklist ghi trong PR |
| P7-03 | Hiệu năng: index DB, kiểm tra truy vấn chậm, kích thước bundle, tải font / ảnh | toàn bộ | TV2 | S | — | Các trang chính tải nhanh trên production |
| P7-04 | E2E bổ sung: Listening, flashcard, trang thống kê | core | TV1 | M | — | Xanh trong CI |
| P7-05 | Rà Swagger: mọi endpoint có ví dụ, mã lỗi, mô tả tiếng Việt rõ ràng | toàn server | TV2 | S | — | Đọc `/docs` hiểu được mà không cần xem code |
| P7-06 | Kiểm tra toàn bộ trên production, chụp snapshot DB, tag `v1.0`, release notes | quản lý | TV1 | S | P7-01 → P7-05 | Release `v1.0` |

## Giai đoạn 8 — Report, thuyết trình, bảo trì (T2 16/11 – CN 22/11)

| Mã | Công việc | Phụ trách | Thời hạn | Tiêu chí hoàn thành |
|---|---|---|---|---|
| P8-01 | Report phần 1: tổng quan, lý do, khảo sát, kiến trúc, tech stack | TV1 | T4 18/11 | Bản nháp đủ mục |
| P8-02 | Report phần 2: ERD, API (ảnh Swagger), quy trình làm việc (board, PR, release), deploy & quản lý web, việc dùng AI | TV2 | T4 18/11 | Bản nháp đủ mục |
| P8-03 | Slide + kịch bản demo theo vòng học | TV1 | T5 19/11 | Tập dượt một lần |
| P8-04 | Quay video demo dự phòng | TV2 | T6 20/11 | Video đủ vòng học |
| P8-05 | Sửa lỗi phát hiện khi tập dượt (`fix/...`, tag `v1.0.x`) | cả hai | T6 20/11 | Không còn lỗi nghiêm trọng |
| P8-06 | Checklist trước khi nộp (Working_rules mục 16), nộp bài | cả hai | CN 22/11 | Đã nộp |

## Đối chiếu nhịp PR

| Giai đoạn | Số issue | TV1 | TV2 |
|---|---|---|---|
| 0–1 | 22 | 10 | 12 |
| 2 | 10 | 5 | 5 |
| 3–4 | 19 | 9 (+1 chung) | 9 (+1 chung) |
| 5–6 | 12 | 6 | 6 |
| 7–8 | 12 | 5 (+2 chung) | 5 (+2 chung) |
| **Tổng** | **75** | **35 (+3)** | **37 (+3)** |

Các issue cỡ L nên được tách thành 2–3 PR khi làm, để đạt nhịp tối thiểu 1 PR mỗi ngày làm việc mỗi người.

---

# Phần E — Deploy & vận hành

| Thành phần | Dịch vụ | Cấu hình chính |
|---|---|---|
| Front-end | Vercel | Thư mục gốc `client`; production = `main`; preview cho mỗi PR; `NEXT_PUBLIC_API_URL` trỏ về API production |
| Back-end | Render (Web Service) | Thư mục gốc `server`; build xong chạy `prisma migrate deploy` rồi mới start; health check `/api/v1/health` |
| Database | Neon PostgreSQL | Branch `main` cho production; branch `dev` cho phát triển ở local; CI dùng Postgres riêng trong container |
| Tên miền | **[CẦN CHỐT]** `.id.vn` hoặc `.me` | `linmaster.<tld>` → Vercel; `api.linmaster.<tld>` → Render; HTTPS qua Cloudflare |
| Audio | Cloudflare R2 | Bucket public chỉ đọc; `R2_PUBLIC_URL` |
| Theo dõi | UptimeRobot | Kiểm tra web + health API mỗi 5 phút; trang status công khai |

**Quy trình release** (cuối giai đoạn 2, 4, 7):
1. Mọi PR của milestone đã merge.
2. Chạy kiểm tra nhanh trên production: đăng nhập → làm đề → trích từ → ôn thẻ → thống kê.
3. Tag `vX.Y` kèm release notes: tính năng, lỗi đã sửa, thay đổi biến môi trường hay migration.
4. Chụp ảnh cho report.

**Rollback:** redeploy bản ổn định gần nhất trên Vercel/Render. Nhờ quy tắc migration chỉ thêm (B5), code cũ vẫn chạy được với schema mới. Sau đó mở Issue `bug` để sửa qua PR.

**Trước buổi demo:** mở web và API trước ít nhất 2 phút (gói free của Render có thể đang "ngủ"). Đăng nhập sẵn tài khoản demo.

---

# Phần F — Định dạng file đề

Mỗi đề là một file JSON trong `content/tests/`, ví dụ `reading-01.json`. Schema chính thức nằm trong `shared`; mô tả dưới đây dùng cho người soạn đề. File audio đặt trong `content/audio/` (không commit) và được upload lên R2.

```json
{
  "slug": "reading-01",
  "skill": "reading",
  "title": "Academic Reading Practice 1",
  "description": "3 passages, 40 questions",
  "durationSec": 3600,
  "source": "Tự soạn bởi nhóm LinMaster",
  "sections": [
    {
      "title": "Passage 1",
      "text": "Đoạn A...\n\nĐoạn B...",
      "groups": [
        {
          "type": "tfng",
          "instruction": "Questions 1–6. Do the following statements agree with the information given in the passage?",
          "questions": [
            { "number": 1, "prompt": "The tower was built in 1889.", "answers": ["TRUE"], "evidence": "completed in March 1889" }
          ]
        },
        {
          "type": "gap",
          "maxWords": 2,
          "instruction": "Questions 7–9. Complete the sentences. Write NO MORE THAN TWO WORDS.",
          "questions": [
            { "number": 7, "prompt": "Visitors must buy a ___ in advance.", "answers": ["ticket", "tickets"], "evidence": "a ticket purchased in advance" }
          ]
        },
        {
          "type": "matching",
          "instruction": "Questions 10–13. Which paragraph contains the following information?",
          "options": ["A", "B", "C", "D", "E"],
          "questions": [
            { "number": 10, "prompt": "a reference to the cost of repairs", "answers": ["C"], "evidence": "repairs cost the city" }
          ]
        }
      ]
    }
  ]
}
```

| Trường | Ghi chú |
|---|---|
| `skill` | `reading` hoặc `listening` |
| `durationSec` | Reading: thường 3600. Listening: tổng thời lượng audio + 120 |
| `text` | Chỉ có ở Reading. Các đoạn cách nhau bằng một dòng trống; đoạn thứ n được gắn nhãn chữ cái thứ n (A, B, C…) |
| `audio`, `audioDurationSec`, `transcript` | Chỉ có ở Listening, mỗi Part một file, ví dụ `"audio": "listening-01-part1.mp3"` |
| `type` | `tfng`, `ynng`, `mcq`, `mcq-multi`, `matching`, `gap` |
| `options` | Phương án của `mcq` / `matching`. Ghi ở cấp nhóm nếu cả nhóm dùng chung, ở cấp câu nếu mỗi câu có phương án riêng |
| `answers` | **Luôn là mảng** các đáp án được chấp nhận, ví dụ `["9 am", "9:00 am"]` |
| `mcq-multi` | Dạng "Choose TWO letters": mỗi số câu vẫn là một mục; cả nhóm ghi chung `answers`, ví dụ `["B", "D"]`; thứ tự nào cũng đúng |
| `evidence` | Câu **chép nguyên văn** từ bài đọc / transcript. Lệnh kiểm tra sẽ báo lỗi nếu không tìm thấy |
| `explanation` | (Không bắt buộc) Giải thích thêm bằng tiếng Việt |

Nếu soạn trực tiếp JSON thấy cực, có thể soạn bằng Word/Google Docs theo cấu trúc trên, AI Agent hỗ trợ chuyển sang JSON. Người soạn vẫn kiểm tra lại kết quả.

---

# Phần G — Rủi ro & phương án cắt giảm

| Rủi ro | Phòng ngừa | Nếu xảy ra |
|---|---|---|
| Trễ tiến độ | Issue nhỏ, kiểm tra tiến độ giữa mỗi giai đoạn | Cắt theo thứ tự cắt bên dưới |
| Gemini lỗi, chậm, hết quota | Cache, retry, quota mỗi người dùng; AI giả lập trong test | Trả lỗi 503 rõ ràng; demo bằng kết quả đã cache; có video dự phòng |
| Render "ngủ" lúc demo | UptimeRobot ping 5 phút một lần | Mở web trước 2 phút |
| Xung đột khi hai người cùng làm | Quy tắc B5; mỗi PR một module | Người merge sau cập nhật branch theo `main`, tạo lại migration |
| Không kịp soạn đủ 4 đề | Bắt đầu soạn từ giai đoạn 0 | Giữ 1 đề mỗi kỹ năng ở mức đủ 40 câu |
| Bản quyền đề, audio | Ghi rõ `source`; ưu tiên tự soạn | Gỡ đề (`isPublished = false`) |
| Lộ secret | `.env.example`, CI không in biến môi trường | Đổi secret ngay, báo cả nhóm |
| Lịch sử PR dồn cục | Bảng nhịp PR; tách issue cỡ L | Ưu tiên PR nhỏ trong các ngày còn lại |
| Thành viên không hiểu code | Review bắt buộc; người mở PR tự giải thích | Dành thời gian đọc lại trước tuần report |

**Thứ tự cắt giảm khi trễ** (cắt từ trên xuống, không chạm vào các phần lõi của vòng học):
1. Toàn bộ backlog mở rộng.
2. Bài tập AI trong flashcard (P5-04 phần exercises, P5-07 phần practice).
3. Widget "tỉ lệ sai theo dạng câu" và "hoạt động" của stats.
4. Đề thứ 2 của mỗi kỹ năng.
5. Nhận file DOCX (giữ PDF và TXT).

---

# Phần H — Việc cần chốt

1. **Hạn nộp chính xác.** Nếu khác 22/11 thì dời các mốc ở A2 và Phần D.
2. **Tên miền:** `.id.vn` hay `.me`, và tên cụ thể.
3. **Ngôn ngữ giao diện:** kế hoạch mặc định là tiếng Việt (nội dung đề bằng tiếng Anh).
4. **Nguồn đề và audio Listening:** tự soạn + tự thu âm, hay dùng text-to-speech.
5. **Report có mẫu bắt buộc của khoa không?**
6. **Đổi tên PrepMaster → LinMaster** trong file proposal (nếu thầy cho sửa) và tên repo GitHub.

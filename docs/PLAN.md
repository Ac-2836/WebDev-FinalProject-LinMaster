# LinMaster — Kế hoạch triển khai

> **LinMaster** — "Lin" trong *Linguistic*. Nền tảng web học tiếng Anh dùng AI: đọc tài liệu và học từ theo ngữ cảnh, flashcard kiểu Quizlet, phòng thi mô phỏng thi máy (CBT), kho chia sẻ cộng đồng và dashboard cá nhân.
>
> **Mục tiêu đồ án:** sản phẩm ở mức cận production, chạy thật mọi chức năng. Không làm gói trả phí hay thanh toán.

Tài liệu này là **kế hoạch thực thi** từ repo trống (T3 03/11/2026) đến lúc nộp (CN 22/11/2026). Nhóm quản lý công việc bằng **Kanban** trên GitHub Projects theo [Working_rules.md](Working_rules.md) mục 6. Tech stack và cấu trúc thư mục xem [Project_Structure.md](Project_Structure.md).

PLAN gồm:
- Phạm vi chia ba mức: **Bắt buộc**, **Nên có**, **Mở rộng**.
- Kiến trúc module.
- Đặc tả ngắn từng module.
- Backlog để nạp lên board: mỗi dòng là **một Issue = một PR**.

Chỗ ghi **[CẦN CHỐT]** là quyết định nhóm còn phải đưa ra.

---

## Mục lục

- **Phần A — Tổng quan:** [A1 Phạm vi](#a1-phạm-vi) · [A2 Mốc thời gian](#a2-mốc-thời-gian) · [A3 Phân công](#a3-phân-công) · [A4 Tiêu chí chấm](#a4-tiêu-chí-chấm--cách-đáp-ứng) · [A5 Việc dùng AI](#a5-việc-dùng-ai-trong-dự-án)
- **Phần B — Kiến trúc module:** [B1 Danh sách](#b1-danh-sách-module) · [B2 Phụ thuộc](#b2-đồ-thị-phụ-thuộc) · [B3 Hợp đồng module](#b3-hợp-đồng-module) · [B4 Điểm mở rộng](#b4-điểm-mở-rộng-registry) · [B5 Chống xung đột](#b5-quy-tắc-chống-xung-đột) · [B6 Tài liệu thiết kế](#b6-tài-liệu-thiết-kế)
- **Phần C — Đặc tả module:** [C0 core](#c0-core) · [C1 auth](#c1-auth) · [C2 vocab](#c2-vocab--đọc-và-học-từ) · [C3 flashcard](#c3-flashcard) · [C4 exam](#c4-exam--thi-thử) · [C5 library](#c5-library--kho-cộng-đồng) · [C6 stats](#c6-stats--dashboard-cá-nhân) · [C7 home](#c7-trang-chủ)
- **Phần D — Backlog theo giai đoạn** · **Phần E — Môi trường & deploy** · **Phần F — Quy định file đề tải lên** · **Phần G — Rủi ro & thứ tự cắt giảm** · **Phần H — Việc cần chốt**

---

# Phần A — Tổng quan

## A1. Phạm vi

**Vòng học lõi:**

```
Đọc tài liệu ─▶ Tra từ không hiểu ─▶ Kho từ ─▶ Bộ flashcard ─▶ Ôn tập
     ▲                                                          │
     └── Mở bài đọc từ kết quả ◀── Thi thử (đề tự tải / kho) ◀──┘
                          Dashboard theo dõi toàn bộ vòng học
```

### Bắt buộc (MVP, phải xong trước mốc đóng băng)

| Module | Chức năng |
|---|---|
| **auth** | Đăng ký, đăng nhập bằng email + mật khẩu. Hồ sơ gồm tên, ngôn ngữ giao diện và mục tiêu band |
| **core** | Giao diện **song ngữ Việt / Anh**, AI gateway, lưu file, Swagger, xử lý lỗi chuẩn |
| **vocab** | **Trình đọc**: dán văn bản hoặc tải PDF/DOCX/TXT để đọc trên web. Bôi chọn một từ hoặc cụm từ → AI giải thích **theo đúng câu đó** (nghĩa Anh–Việt, IPA, cách dùng, collocations) → lưu vào kho từ, kèm câu gốc. **Lọc nhanh**: AI quét cả văn bản để lọc từ theo trình độ CEFR và/hoặc chủ đề. **Kho từ**: tìm kiếm, lọc, xóa, tạo bộ thẻ từ các từ đã chọn |
| **flashcard** | Tạo và **sửa** bộ thẻ kiểu Quizlet (thêm, xóa, đổi thứ tự thẻ). Tạo bộ thẻ từ kho từ. Hai chế độ học: **Thẻ lật** và **Học** (lặp lại ngắt quãng SM-2) |
| **exam** | **Tải đề lên** (Reading, Listening hoặc Full) theo hai cách: **Theo mẫu** (mỗi ô một file) hoặc **AI nhận diện** (thả file tùy ý, AI tự tìm đề, câu hỏi, đáp án, giải thích, transcript và báo thành phần còn thiếu). Hệ thống kiểm tra rồi tạo đề thi riêng tư. **Phòng thi CBT** bám sát giao diện thi máy IELTS tại điểm thi chính thức. Chấm điểm, quy ra band, trang kết quả |
| **library** | Kho cộng đồng cho **bộ thẻ** và **đề thi**. Chủ sở hữu tự đăng lên hoặc gỡ xuống. Người khác tìm kiếm, xem trước, chép bộ thẻ về thư viện của mình, làm đề, báo cáo vi phạm |
| **stats** | **Dashboard cá nhân** kiểu trang hồ sơ GitHub: lịch hoạt động, chuỗi ngày học, thẻ số liệu, biểu đồ, điểm yếu theo dạng câu |
| **home** | Trang chủ sau khi đăng nhập: tiếp tục bài dở, thẻ đến hạn, tài liệu gần đây |

### Nên có (làm trong kế hoạch, nhưng bị cắt đầu tiên khi trễ, xem Phần G)
- Flashcard: dán nhanh nhiều thẻ (mỗi dòng `thuật ngữ<Tab>định nghĩa`). Chế độ **Kiểm tra** tự sinh câu hỏi từ chính bộ thẻ. Chế độ **Ghép thẻ** (Match).
- Flashcard: **AI sinh bài luyện tập** theo dạng câu thi thật (trắc nghiệm, điền chỗ trống, nối) từ các từ trong bộ thẻ.
- Exam: **AI giải thích đáp án** và chỉ ra bằng chứng trong bài khi người dùng bấm xem.
- Exam: dạng câu điền nhãn bản đồ / sơ đồ (cần cắt ảnh từ PDF).
- Exam: khi tải đề không có transcript thì AI nghe audio để tự tạo transcript và mốc từng Part (P3-18).

### Mở rộng (chỉ làm khi vượt tiến độ; nếu không, ghi vào mục "Hướng phát triển" của report)
- **Extension trình duyệt** để tra từ trên mọi trang web. API tra từ đã thiết kế sẵn cho việc này (C2).
- Nhập tài liệu bằng URL. Đăng nhập Google. Trang hồ sơ công khai `/u/<tên>`.
- Ảnh trên thẻ. Đánh giá sao và bình luận trong kho cộng đồng. Xuất bộ thẻ ra CSV.
- Chứng chỉ khác (TOEIC, TOEFL…). Kiến trúc đã chừa sẵn chỗ (B4).

### Ngoài phạm vi
Writing, Speaking, thanh toán, ứng dụng di động.

## A2. Mốc thời gian

Ngày hôm nay là T3 03/11/2026. Hạn nộp là CN 22/11/2026.

| Giai đoạn | Thời gian | Nội dung | Mốc |
|---|---|---|---|
| 0 | T3 03/11 – T5 05/11 | **Phân tích & thiết kế** (use case, ERD, activity, sequence, state, wireframe) song song với chuẩn bị (board, monorepo, Postgres Docker, CI, khung client/server) | Bộ sơ đồ và ERD được duyệt; khung chạy ở local, CI xanh |
| 1 | T5 05/11 – T7 07/11 | Nền móng: core, auth, AI gateway, lưu file, giao diện song ngữ | Đăng ký / đăng nhập được ở local |
| 2 | CN 08/11 – T3 10/11 | vocab (trình đọc, tra từ, lọc nhanh, kho từ) + flashcard lõi | **`v0.1`** (local): Đọc → Tra → Lưu → Bộ thẻ → Học |
| 3 | T3 10/11 – T6 13/11 | exam: tải đề, phòng thi Reading + Listening, chấm, kết quả. **Deploy lên subdomain miễn phí ngày T4 11/11** | **`v0.2`** (online): Thi → Kết quả → Đọc lại bài để học từ |
| 4 | T7 14/11 – T2 16/11 | library, dashboard, trang chủ, các phần "Nên có" | Đủ module |
| 5 | **T3 17/11** – T4 18/11 | **Đóng băng tính năng từ T3 17/11.** Hoàn thiện, rà soát, e2e, đối chiếu sơ đồ với code | **`v1.0`** |
| 6 | T5 19/11 – CN 22/11 | Report (dùng lại bộ sơ đồ của Giai đoạn 0), slide, video demo. Chỉ sửa lỗi | `v1.0.x`, nộp bài |

## A3. Phân công

| Người | Phụ trách chính | Review |
|---|---|---|
| **Khai Hung** (KH) | Toàn bộ front-end (`client/**`). **Schema database** (`server/prisma/`). **AI**: AI gateway, mọi prompt và task AI. **Mock data và seed**. Board GitHub Projects | PR của TH |
| **Tien Hung** (TH) | Back-end xử lý dữ liệu: hạ tầng server, auth, CRUD, lịch ôn SM-2, chấm điểm. **Phần không phải AI** của luồng tải đề (nhận file, lưu file, job, lớp kiểm tra trước khi lưu). Toàn bộ **library**, **API dashboard**, CI, deploy, test e2e | PR của KH |
| **AI Agent** | Code, test, API doc theo từng issue được giao, theo [Working_rules.md](Working_rules.md) mục 3 | — |

- Cột **Phụ trách** trong Phần D là người kéo thẻ đó. Người đó mở PR, hiểu code và trả lời khi vấn đáp.
- **Schema đi trước API:** mỗi module có một issue DB do KH làm trước, để TH viết endpoint trên bảng đã có trên `main`.
- **Schema `shared/` của một endpoint do người viết endpoint đó soạn.** Ví dụ: TH soạn schema cho CRUD, KH soạn schema cho output của task AI.
- **Giai đoạn 0 do KH làm toàn bộ** (chốt 04/11), kể cả các thẻ ban đầu giao TH (khung repo, CI, template). Từ Giai đoạn 1 áp dụng lại phân công trên.
- KH ôm nhiều việc hơn. Vì vậy CI, deploy, e2e và các buổi rà soát server được chuyển cho TH, để số PR của hai người không lệch quá xa.

## A4. Tiêu chí chấm → cách đáp ứng

| Tiêu chí | Mức | Đáp ứng bằng |
|---|---|---|
| Lịch sử PR đều đặn, quản lý dự án sát thực tế | Cao | Kanban có giới hạn WIP (Working_rules mục 6). Backlog chia nhỏ (Phần D). Review chéo. Release theo mốc |
| Publishment (deploy, quản lý web, tên miền) | Cao | Deploy lên subdomain từ 11/11, gắn tên miền khi mua. Preview cho mỗi PR. Theo dõi uptime. Quy trình rollback (Phần E) |
| Có database | Tối thiểu | PostgreSQL + Prisma. Schema tách theo module. Migration có lịch sử. Seed |
| Có API doc (**bắt buộc Swagger**) | Tối thiểu | Swagger UI tại `/docs`, sinh từ Zod schema. CI kiểm tra mọi route đều có doc |
| Hoàn thành chức năng | Tối thiểu | 8 module, mỗi module có tiêu chí hoàn thành (Phần C) |
| Thuyết trình, report | Tối thiểu | Bộ sơ đồ UML và ERD làm từ Giai đoạn 0 (B6). Giai đoạn 6 dành riêng. Ảnh chụp và số liệu thu thập từ đầu |

## A5. Việc dùng AI trong dự án

- **Trong sản phẩm:** Gemini dùng cho 8 task, mỗi task một tên có phiên bản:
  - `explain-word.v1`: giải thích từ theo ngữ cảnh (C2).
  - `scan-document.v1`: lọc từ theo CEFR / chủ đề (C2).
  - `classify-pages.v1`: gắn nhãn từng trang của file đề (C4).
  - `parse-test.v1`, `parse-answers.v1`: tách cấu trúc đề, đáp án và giải thích có sẵn trong file (C4).
  - *(Nên có)* `parse-audio.v1`: tạo transcript từ audio khi bộ file không có (C4, P3-18).
  - *(Nên có)* `generate-exercise.v1`: sinh bài luyện tập từ bộ thẻ (C3, P4-11).
  - *(Nên có)* `explain-answer.v1`: giải thích đáp án khi file đề không kèm giải thích (C4, P4-12).
  - Mọi lệnh gọi đi qua AI gateway (C0), có cache và quota.
- **Trong quá trình làm:** nhóm dùng AI Agent (Claude Code) để hỗ trợ viết code, test và tài liệu, theo luật [Working_rules.md](Working_rules.md) mục 3. Người phụ trách đọc hiểu và chịu trách nhiệm cho mọi PR. Report có mục riêng nói về việc này.
- **Nội dung đề thi do người cung cấp.** AI chỉ chuyển file (PDF, audio) thành cấu trúc, **không** sinh nội dung đề hay đáp án. Giải thích do AI tạo (`explain-answer.v1`) luôn ghi rõ "Do AI tạo".

---

# Phần B — Kiến trúc module

## B1. Danh sách module

| Module | Trách nhiệm | Bảng sở hữu (dự kiến) |
|---|---|---|
| `core` | Cấu hình, DB client, lỗi, validate, bảo mật, JWT, **AI gateway**, **lưu file**, Swagger, i18n (client), module registry | `AiCache`, `AiUsage` |
| `auth` | Tài khoản, phiên đăng nhập, hồ sơ | `User` |
| `exam` | Đề thi (tải lên, nhận diện, kiểm tra), lượt làm bài, chấm điểm, kết quả, registry chứng chỉ và dạng câu | `Test`, `TestSection`, `Passage`, `QuestionGroup`, `Question`, `TestImport`, `Attempt`, `AttemptAnswer` |
| `vocab` | Tài liệu đọc, tra từ, lọc nhanh, kho từ | `Document`, `VocabEntry` |
| `flashcard` | Bộ thẻ, thẻ, tiến độ học SM-2, phiên học, bài luyện tập | `FlashcardSet`, `Card`, `CardProgress`, `StudySession` |
| `library` | Đăng lên / gỡ xuống, tìm kiếm, xem trước, chép bộ thẻ, báo cáo | `Report` (trạng thái công khai nằm trên bảng của module sở hữu nội dung) |
| `stats` | Tổng hợp số liệu cho dashboard (chỉ đọc qua public API của các module khác) | — |
| `home` | Trang chủ: chỉ có ở client, ghép widget của các module | — |

## B2. Đồ thị phụ thuộc

```
core ◀── auth ◀── exam ◀── vocab ◀── flashcard ◀── library ◀── stats
                    ▲                                 │
                    └─────────────────────────────────┘   (library đọc cả exam lẫn flashcard)
```

- Mũi tên có nghĩa là "được dùng bởi". Module bên phải được gọi public API của module bên trái, **không bao giờ ngược lại**.
- `vocab` dùng `exam` để tạo tài liệu đọc từ bài thi đã nộp.
- `flashcard` dùng `vocab` để tạo thẻ từ kho từ và kiểm tra quyền sở hữu.
- `library` dùng `exam` và `flashcard` để liệt kê, xem trước và chép nội dung công khai.
- `stats` chỉ đọc, không ghi bảng của ai.
- Ở client, các feature không import lẫn nhau. Trang này nối sang trang khác bằng URL.

## B3. Hợp đồng module

- **Server:** mỗi module xuất ra một *module definition* gồm tên, router, đăng ký Swagger, task AI và public API (các hàm module khác được gọi). `server/src/modules/index.ts` đăng ký mỗi module bằng **một dòng**.
- **Client:** mỗi module là một thư mục trong `client/features/<module>/`, có một điểm export công khai duy nhất. Module đăng ký mục điều hướng vào nav registry và widget vào home widget registry.
- **Shared:** mỗi module có `shared/src/<module>/` chứa Zod schema của request/response, kiểu dữ liệu và hằng số.
- **Database:** mỗi module có một file `server/prisma/schema/<module>.prisma`.
- **i18n:** chuỗi giao diện nằm trong `client/messages/{vi,en}.json`, mỗi module có namespace riêng. API trả về **mã lỗi**, client dịch mã lỗi thành câu thông báo.

## B4. Điểm mở rộng (registry)

| Registry | Ở đâu | Thêm một mục để |
|---|---|---|
| Module registry | server | Thêm module mới |
| Nav registry, home widget registry, dashboard widget registry | client | Thêm trang hoặc widget mới |
| **Certification registry** | shared + client | Thêm chứng chỉ mới (TOEIC…): khai báo các kỹ năng, thời gian, số câu, bảng quy đổi band, layout phòng thi |
| **Question kind registry** | shared + client | Thêm dạng câu: schema đáp án, cách chuẩn hóa, cách chấm, component hiển thị |
| AI task registry | server core | Thêm task AI: prompt có đánh phiên bản, schema output, chính sách cache |
| Document source registry | server vocab | Thêm nguồn tài liệu: dán văn bản, file, bài thi, sau này là URL hoặc extension |
| Study mode registry | client flashcard | Thêm chế độ học: thẻ lật, Học, Kiểm tra, Ghép thẻ |
| Storage driver | server core | `local` (ổ đĩa, khi phát triển) / `r2` (khi deploy) |

## B5. Quy tắc chống xung đột
- Mỗi PR chỉ chạm **một module**, cộng thêm `shared/<module>` của module đó. Thêm module hay registry mới chỉ được sửa **một dòng** ở file đăng ký.
- **Migration chỉ thêm, không phá:** chỉ thêm bảng, thêm cột có giá trị mặc định hoặc cho phép null. Muốn đổi tên hay xóa thì làm hai bước, qua hai PR.
- Hai PR cùng tạo migration: người merge sau cập nhật branch theo `main`, xóa migration của mình rồi tạo lại.
- File i18n: mỗi PR chỉ thêm key vào namespace của module mình.

## B6. Tài liệu thiết kế

- Sơ đồ viết bằng **PlantUML** (file `.puml`) trong thư mục `Analysis_Design/` ở gốc repo, review trong PR như code. Mỗi sơ đồ xuất thành một ảnh PNG độ phân giải cao (`bash Analysis_Design/render.sh`) đặt cạnh file nguồn, dùng cho report; không vẽ hay sửa ảnh bằng tay.
- Sơ đồ thể hiện **thiết kế đã duyệt**. PR nào làm code khác đi so với thiết kế thì phải cập nhật sơ đồ liên quan ngay trong PR đó. Ở P5-07, ERD được sinh lại từ Prisma để đối chiếu.
- **Đặc tả use case** dùng mẫu: Tên · Actor · Tiền điều kiện · Luồng chính · Luồng thay thế / lỗi · Hậu điều kiện. Đặc tả đủ mọi use case có trong sơ đồ; use case Nên có ghi rõ.

| Loại sơ đồ | Nội dung | Issue |
|---|---|---|
| Use case tổng | Actor: Khách, Người học, Gemini (hệ thống ngoài). Toàn bộ use case, gom theo module | P0-03 |
| Use case chi tiết + đặc tả | vocab, flashcard, exam | P0-03 |
| | auth, library, stats | P0-04 |
| ERD + từ điển dữ liệu | Mọi bảng, khóa, quan hệ, ràng buộc duy nhất; mỗi bảng thuộc module nào | P0-05 |
| Activity | Đọc → tra → lưu từ; Tạo / sửa bộ thẻ và học | P0-06 |
| | Tải đề; Làm bài thi (tự lưu, hết giờ, nộp); Đăng lên và chép từ kho | P0-07 |
| | *(Nên có)* Luyện tập do AI sinh từ bộ thẻ (`act-09`) | P4-11 |
| Sequence | Tra từ và Lọc nhanh qua AI gateway | P0-08 |
| | Đăng nhập; Tải đề (job nền); Làm bài, tự lưu, nộp; Chép bộ thẻ | P0-09 |
| | Giải thích đáp án (`seq-11`); *(Nên có)* sinh bài luyện tập (`seq-10`) | P4-11, P4-12 |
| State | `Attempt`; `TestImport`; trạng thái công khai của nội dung; tiến độ thẻ | P0-10 |
| Component, Deployment, Class | Kiến trúc module và các registry; triển khai ở local và online | P0-11 |
| Wireframe | Trình đọc, trình soạn thẻ, chế độ học, phòng thi, kết quả, dashboard | P0-12 |

---

# Phần C — Đặc tả module

> Đặc tả ở mức đủ để làm và review. Chi tiết như tên trường hay mã lỗi được chốt trong PR schema (issue DB) và trong Swagger. Các endpoint đều có tiền tố `/api/v1` và đều yêu cầu đăng nhập, trừ khi ghi khác.

## C0. `core`

**Server:**
- Lỗi chuẩn `{ error: { code, message, details? } }`. Middleware validate Zod. Bọc handler async.
- Bảo mật: helmet, CORS theo danh sách cho phép, rate limit, giới hạn body, JWT, `requireAuth`.
- **AI gateway:** `runJsonTask(task, input)`.
  - Gọi Gemini với schema output, rồi validate kết quả bằng Zod. JSON sai thì thử lại tối đa 2 lần.
  - Cache theo hash của input. Quota mỗi người dùng mỗi ngày, quá quota thì trả `429 AI_QUOTA_EXCEEDED`.
  - Ghi `AiUsage`. Có bản mock để chạy test.
  - Nhận được đầu vào là file PDF.
- **Lưu file:** `storage.put / get / delete`. Driver `local` lưu vào thư mục `uploads/` (không commit), driver `r2` dùng khi deploy. Kiểm tra MIME và kích thước ngay khi nhận file.
- Swagger UI tại `/docs`, đặc tả tại `/docs/openapi.json`. Test route-coverage: route nào chưa có doc thì test báo lỗi.

**Client:**
- API client duy nhất: gắn JWT, chuyển mã lỗi thành câu đã dịch.
- Phiên đăng nhập (context). Trang cần đăng nhập thì chặn và chuyển về `/login?next=...`.
- **i18n với `next-intl`, hai ngôn ngữ `vi` và `en`.** Có nút đổi ngôn ngữ, lựa chọn lưu vào hồ sơ.
- Ba nhóm layout: công khai, ứng dụng, phòng thi (toàn màn hình).
- Navbar sinh từ nav registry. Có toast, trang 404/lỗi, skeleton, trạng thái trống.

**Hoàn thành khi:** lỗi Zod và lỗi không lường trước đều ra đúng định dạng chuẩn (có test); `/docs` hiển thị; đổi ngôn ngữ giữ được sau khi refresh.

## C1. `auth`

- **Dữ liệu:** `User`: email (duy nhất), passwordHash, displayName, locale (`vi`/`en`), targetBand (có thể bỏ trống), createdAt.
- **API:** `POST /auth/register`, `POST /auth/login` (công khai, rate limit chặt), `GET /auth/me`, `PATCH /auth/me`.
- **Giao diện:** `/login`, `/register`, `/profile`, đăng xuất.
- **Hoàn thành khi:** sai mật khẩu ra 401 với thông báo không lộ là email có tồn tại hay không; thiếu token thì 401; mật khẩu được hash bằng bcrypt (có test).

## C2. `vocab` — Đọc và học từ

**Ý tưởng:** người học đọc bài báo hoặc tài liệu tiếng Anh. Gặp từ không hiểu, họ bôi chọn để được giải thích **theo đúng ngữ cảnh**, và những "chỗ không hiểu" đó được gom lại thành kho từ để ôn.

**Dữ liệu:**
- `Document`: chủ sở hữu, tiêu đề, nguồn (`paste` | `file` | `exam`), nội dung chữ đã chuẩn hóa thành các đoạn, `sourceRef` (ví dụ id của attempt và passage). **Không lưu file gốc**, chỉ lưu chữ.
- `VocabEntry`: chủ sở hữu, headword, lemma, loại từ, IPA, nghĩa tiếng Việt, định nghĩa tiếng Anh, ghi chú cách dùng, collocations[], câu gốc, documentId (có thể null), vị trí (offset) trong tài liệu, CEFR, chủ đề[], ghi chú riêng, createdAt. Mỗi người dùng chỉ có một entry cho cùng một lemma và loại từ; lưu trùng thì gộp câu gốc.

**API:**

| Endpoint | Việc |
|---|---|
| `POST /vocab/documents` | Tạo tài liệu từ văn bản dán vào, hoặc file PDF/DOCX/TXT (≤ 5 MB, multipart). Server trích chữ ra |
| `GET /vocab/documents`, `GET/DELETE /vocab/documents/:id` | Danh sách, chi tiết (kèm danh sách từ đã lưu trong tài liệu để tô lại), xóa |
| `POST /vocab/lookups` | **Tra từ theo ngữ cảnh.** Đầu vào: `{ text, sentence, documentId?, sourceUrl? }`. Trả về giải thích. **Không phụ thuộc giao diện web**, để extension trình duyệt dùng lại được |
| `POST /vocab/documents/:id/scan` | **Lọc nhanh.** Đầu vào: `{ levels?: CEFR[], topics?: string[] }`. Trả về danh sách ứng viên kèm câu gốc. Server kiểm tra lại câu gốc phải có thật trong văn bản; câu nào AI bịa ra thì loại |
| `POST /vocab/entries` | Lưu một hoặc nhiều từ |
| `GET /vocab/entries` | Tìm kiếm, lọc theo chủ đề / CEFR / tài liệu, phân trang |
| `PATCH/DELETE /vocab/entries/:id` | Sửa ghi chú, xóa |

**Task AI:**
- `explain-word.v1`: input là từ + câu chứa từ. Trả về headword, lemma, loại từ, IPA, nghĩa Việt **đúng nghĩa trong câu**, định nghĩa Anh, ghi chú cách dùng, collocations, CEFR, chủ đề.
- `scan-document.v1`: lọc từ theo trình độ và chủ đề.
- Danh sách chủ đề có sẵn: khoảng 15 chủ đề quen thuộc của IELTS, cộng một ô nhập tự do.

**Giao diện:**
- `/read`: danh sách tài liệu, nút "Tài liệu mới" (dán văn bản hoặc tải file).
- `/read/[id]`: **trình đọc**.
  - Bôi chọn (tối đa 6 từ) → popover hiện giải thích → nút "Lưu".
  - Từ đã lưu được tô màu khi mở lại tài liệu.
  - Bảng bên cạnh có "Lọc nhanh" (chọn CEFR và chủ đề → danh sách ứng viên có checkbox → lưu) và danh sách từ đã lưu trong tài liệu.
  - Dùng được bằng bàn phím: chọn từ xong bấm phím tắt để tra.
- `/vocab`: **kho từ**. Có tìm kiếm, lọc, xóa, chọn nhiều từ → "Tạo bộ thẻ".

**Hoàn thành khi:**
- Tra cùng một từ trong hai câu khác nghĩa thì ra hai nghĩa khác nhau.
- Câu ví dụ bịa bị loại khỏi kết quả lọc nhanh.
- Quá quota AI thì báo lỗi rõ ràng bằng ngôn ngữ đang chọn.
- Người khác truy cập tài liệu thì bị 403 hoặc 404.

## C3. `flashcard`

Bám theo mô hình Quizlet.

**Dữ liệu:**
- `FlashcardSet`: chủ sở hữu, tiêu đề, mô tả, ngôn ngữ của thuật ngữ và định nghĩa, `visibility` (`private` | `public`), `publishedAt`, `copiedFromId`, `copyCount`.
- `Card`: setId, thứ tự, thuật ngữ, định nghĩa, ví dụ (có thể bỏ trống), vocabEntryId (có thể null).
- `CardProgress`: tiến độ SM-2 theo từng người dùng và từng thẻ (easiness, interval, repetitions, dueAt). Tách riêng khỏi thẻ, để bộ thẻ chép từ người khác có tiến độ của riêng mình.
- `StudySession`: người dùng, bộ thẻ, chế độ học, thời điểm bắt đầu và kết thúc, số thẻ. Dashboard dùng bảng này để tính thời gian học.

**API:**

| Endpoint | Việc |
|---|---|
| `POST/GET /flashcards/sets`, `GET/PATCH/DELETE /flashcards/sets/:id` | CRUD bộ thẻ. Chỉ chủ sở hữu được sửa |
| `PUT /flashcards/sets/:id/cards` | Ghi đè toàn bộ danh sách thẻ khi lưu trình soạn (thêm, sửa, xóa, đổi thứ tự trong một lần gửi) |
| `POST /flashcards/sets/from-vocab` | Tạo bộ thẻ từ `vocabIds[]` (kiểm tra quyền qua public API của vocab) |
| `GET /flashcards/sets/:id/study` | Lấy các thẻ đến hạn và thẻ mới, có giới hạn mỗi ngày tính theo giờ Việt Nam |
| `POST /flashcards/reviews` | Chấm một thẻ (Again / Hard / Good / Easy), cập nhật SM-2 |
| `POST /flashcards/sessions`, `PATCH /flashcards/sessions/:id` | Bắt đầu và kết thúc phiên học |
| *(Nên có)* `GET /flashcards/sets/:id/quiz` | Sinh câu hỏi Kiểm tra từ chính bộ thẻ (trắc nghiệm, tự gõ, đúng/sai) |
| *(Nên có)* `POST /flashcards/sets/:id/exercises` | Task AI `generate-exercise.v1`: bài luyện tập theo dạng câu thi. Đầu vào: `{ kinds: ('single_choice' \| 'completion' \| 'matching')[], count: 10 \| 20 }`. Trả về câu hỏi kèm đáp án để chấm ngay ở client. Không lưu DB, chỉ cache theo bộ thẻ + tham số |

**Giao diện:**
- `/flashcards`: các bộ thẻ của tôi.
- `/flashcards/new` và `/flashcards/[id]/edit`: **trình soạn** dạng các hàng thuật ngữ / định nghĩa. Có thêm, xóa, kéo thả hoặc dùng phím để đổi thứ tự, và *(Nên có)* dán nhanh nhiều thẻ.
- `/flashcards/[id]`: xem trước bộ thẻ, danh sách thẻ, các nút chế độ học.
- `/flashcards/[id]/study/[mode]`:
  - **Thẻ lật**: lật 3D, phím cách để lật, phím mũi tên để chuyển thẻ.
  - **Học**: 4 nút chấm, phím 1–4, thanh tiến độ, tổng kết cuối phiên.
  - *(Nên có)* **Kiểm tra** và **Ghép thẻ** (bộ thẻ cần ít nhất 4 thẻ để có phương án nhiễu).
  - *(Nên có)* **Luyện tập AI** (`/flashcards/[id]/study/exercise`, bộ thẻ cần ít nhất 4 thẻ): chọn dạng câu và số câu → AI soạn câu hỏi chỉ dùng các từ trong bộ thẻ → làm bài, chấm ngay, xem đáp án.
    - Server kiểm tra từng câu: đúng schema dạng câu, đáp án nằm trong phương án, chỉ dùng từ của bộ thẻ. Câu không đạt thì bỏ; còn dưới một nửa số câu yêu cầu thì báo lỗi.

**Hoàn thành khi:**
- Đạt đủ các unit test SM-2.
- Sửa bộ thẻ thì không mất tiến độ học của các thẻ còn giữ lại.
- Ôn hết một phiên chỉ bằng bàn phím được.
- Người khác không sửa được bộ thẻ (403).

## C4. `exam` — Thi thử

**Mục tiêu giao diện:** **bám sát bố cục và thao tác** của phần mềm thi máy IELTS tại điểm thi chính thức (IDP / British Council). **Không** dùng logo, tên thương hiệu hay tài sản đồ họa của các tổ chức này.

**Registry chứng chỉ (shared):**
- IELTS (Academic) khai báo:
  - Listening: 4 part, 40 câu, khoảng 30 phút + 2 phút kiểm tra lại.
  - Reading: 3 passage, 40 câu, 60 phút.
  - Bảng quy đổi điểm sang band của từng kỹ năng.
  - Layout phòng thi.
- Thêm chứng chỉ khác về sau chỉ cần thêm một mục vào registry.

**Registry dạng câu (shared):** mỗi dạng có schema đáp án, cách chuẩn hóa (bỏ hoa thường, khoảng trắng, mạo từ theo quy tắc), cách chấm và component hiển thị. Gồm:
- Trắc nghiệm một đáp án.
- Trắc nghiệm nhiều đáp án (chọn N).
- True / False / Not Given.
- Yes / No / Not Given.
- Nối: heading, thông tin, đặc điểm, nửa câu sau.
- Điền chỗ trống: câu, tóm tắt, ghi chú, bảng, form, flow-chart. Có danh sách đáp án chấp nhận và giới hạn số từ.
- Trả lời ngắn.
- *(Nên có)* Điền nhãn bản đồ / sơ đồ.

**Luồng tải đề.** Có hai chế độ, là hai tab của màn tải đề. Quy định file của từng chế độ nằm ở Phần F.

```
Tab "Theo mẫu":  chọn loại đề + mỗi ô một file ─────────────────────────┐
Tab "AI nhận diện": thả file dần ─▶ gắn nhãn trang ─▶ bảng Độ đầy đủ ─▶ đủ ┤
                                                                         ▼
          Job: trích nội dung (AI, chạy song song) ─▶ Kiểm tra ─▶ Đề riêng tư (+ cảnh báo)
                                                        └─ lỗi chặn ─▶ Báo lỗi theo từng câu
```

1. **Đưa file lên** (cả hai tab), mỗi lần một file:
   - `POST /tests/imports/files` (multipart): lưu file vào `StoredFile`, trả về `fileId`.
     - PDF chạy task `classify-pages.v1`, cache trong `AiCache` theo hash file. Task gắn nhãn cho từng trang: `instructions` | `passage` | `questions` | `answers` | `explanations` | `transcript` | `other`, kèm kỹ năng và khoảng số câu thấy trên trang.
     - Audio chỉ đọc độ dài (`StoredFile.durationSec`), không dùng AI.
     - Trả về nhãn của file. File không nhận ra là đề thì có cờ `unused`.
   - `DELETE /tests/imports/files/:fileId`: bỏ một file chưa thuộc lượt tải nào (chỉ chủ file).
   - **Bảng Độ đầy đủ** là hàm thuần `buildChecklist(files)` trong `shared/exam`. Client gọi sau mỗi file để hiện bảng, server gọi lại ở bước 2. Không lưu vào DB.
   - Tab Theo mẫu gửi kèm ô người dùng chọn cho từng file. Tab AI nhận diện không cần.
2. **Tạo lượt tải** `POST /tests/imports` `{ kind, files: [{ fileId, slot? }] }`:
   - Tối đa 10 file. Server tính lại bảng Độ đầy đủ. Thiếu thành phần bắt buộc (hoặc tab Theo mẫu thiếu ô bắt buộc) thì 422, kèm bảng.
   - Đủ thì gộp các PDF thành một PDF, gán vào `questionFileId` và `answerFileId`, audio vào `audioFileId`. Tạo `TestImport` (`queued`), trả về `importId`. **Không đổi schema DB.**
   - Loại đề do client gửi: tab Theo mẫu là loại người dùng chọn, tab AI nhận diện là loại suy ra từ các kỹ năng tìm thấy (người dùng đổi được).
   - *shortcut:* file đã đưa lên nhưng không thuộc lượt tải nào sau 24 giờ thì bị xóa bởi một tác vụ dọn dẹp chạy định kỳ.
3. **Job nền** (`queued` → `parsing` → `validating` → `done` | `failed`). Mỗi task chỉ nhận đúng các trang đã gắn nhãn cho nó.
   - Job đọc nhãn trang của PDF đã gộp (`classify-pages.v1`, cache theo hash), nên đề có đáp án ở cuối hay nhiều file đều xử lý như nhau.
   - `parse-test.v1`: trang bài đọc và câu hỏi → cấu trúc (section, passage chia đoạn A, B, C…, nhóm câu, dạng câu, phương án, giới hạn số từ).
   - `parse-answers.v1`: trang đáp án và giải thích → đáp án theo số câu, **giải thích gắn vào từng câu** (nếu có, lưu trong `Question.answer.explanation`). **Tự nhận ra đáp án nào thuộc phần nào** (Listening / Reading) khi là đề Full.
   - Transcript lấy từ các trang `transcript` (nếu có), lưu vào `Passage.paragraphs` của đúng Part Listening.
   - *(Nên có, P3-18)* `parse-audio.v1`: khi không có transcript thì nghe audio để tạo transcript và mốc bắt đầu từng Part. Cắt hình bản đồ / sơ đồ từ PDF theo tọa độ AI trả về.
4. **Lớp kiểm tra (không dùng AI)**, chia làm hai mức:
   - **Lỗi chặn** → `failed`, kèm danh sách lỗi theo từng câu:
     - Số câu từng phần sai so với registry chứng chỉ, hoặc đánh số không liên tục.
     - Câu thiếu đáp án, hoặc đáp án không hợp lệ với dạng câu.
     - Listening không đọc được độ dài audio.
   - **Cảnh báo** → vẫn `done`, lưu trong `errors` với `severity: 'warning'`: thiếu giải thích (bù bằng AI giải thích, P4-12), thiếu transcript, file không dùng đến.
5. `GET /tests/imports/:id`: trả về trạng thái và `errors` (cả lỗi chặn lẫn cảnh báo). Client hỏi lại mỗi vài giây.

**Dữ liệu:**
- `Test`: chủ sở hữu, chứng chỉ, loại, tiêu đề, `visibility`, `publishedAt`, `attemptCount`.
- `TestSection` (Listening có audio) → `Passage` (hoặc Part) → `QuestionGroup` (hướng dẫn, dạng câu, phương án dùng chung) → `Question` (số câu, nội dung, đáp án đúng).
- Tải đề hai tab **không đổi schema**, chỉ thêm quy ước cho các cột jsonb có sẵn (schema Zod trong `shared/exam`):
  - Giải thích: `Question.answer.explanation`.
  - Transcript: `Passage.paragraphs` của Part Listening. **Không gửi cho thí sinh trước khi nộp bài**, giống đáp án.
  - Cảnh báo: phần tử `TestImport.errors` có `severity: 'warning'`.
  - Khi bộ file có nhiều PDF, `questionFileId` và `answerFileId` cùng trỏ tới PDF đã gộp.
- `Attempt`: người làm, đề, `startedAt`, `deadlineAt`, trạng thái (`in_progress` | `submitted`), state đã lưu (đáp án, highlight, ghi chú, câu đánh dấu), điểm, band.
- `AttemptAnswer`: ghi lại đáp án đúng **tại thời điểm chấm**, để chủ đề sửa đề sau này không làm đổi kết quả cũ.

**API khác:**

| Endpoint | Việc |
|---|---|
| `GET /tests` | Đề của tôi |
| `GET /tests/:id` | Bản dành cho thí sinh, **không bao giờ có đáp án, giải thích hay transcript Listening** |
| `PATCH/DELETE /tests/:id` | Đổi tiêu đề, xóa (chỉ chủ đề). **Đề đã có người khác làm (`attemptCount > 0`) thì không xóa được**, trả 409 `TEST_HAS_ATTEMPTS`; chủ đề chỉ gỡ khỏi kho (C5) để giữ lịch sử làm bài của người khác |
| `POST /attempts` | Bắt đầu làm bài. Nếu đang có bài dở của đề này thì trả lại bài dở |
| `GET /attempts/:id` | Trả về `serverNow`, thời gian còn lại, vị trí audio tính theo giờ server. Quá hạn thì tự nộp bài khi được gọi (nộp lười) |
| `PUT /attempts/:id/state` | Tự lưu. Quá hạn thì từ chối |
| `POST /attempts/:id/submit` | Chấm điểm và quy ra band. Gọi lại nhiều lần thì kết quả không đổi |
| `GET /attempts/:id/result`, `GET /attempts` | Kết quả chi tiết (kèm giải thích có sẵn trong file và transcript Listening), lịch sử làm bài |
| *(Nên có)* `POST /attempts/:id/questions/:no/explain` | Task AI `explain-answer.v1`: giải thích đáp án và chỉ ra bằng chứng (đoạn, câu trích) trong passage hoặc transcript. Chỉ cho bài đã nộp, của chính mình. Câu đã có giải thích từ file thì trả lại giải thích đó, không gọi AI. Cache theo câu hỏi + đáp án của người làm |
| **public API** | `getPassageText(attemptId, passageId)` (chỉ khi đã nộp bài), cùng các hàm thống kê cho `stats` |

**Phòng thi (client):**
- **Header:** tên thí sinh, đồng hồ đếm ngược theo giờ server, nút Settings (cỡ chữ, bảng màu tương phản), Help, Hide.
- **Reading:**
  - Hai cột bài đọc / câu hỏi, kéo được vạch chia.
  - Bôi chọn để **highlight** hoặc **ghi chú** (qua menu chuột phải), xóa được highlight.
  - Gạch bỏ phương án.
- **Listening:**
  - Audio tự phát, **không** tạm dừng, **không** tua. Có chỉnh âm lượng.
  - Refresh thì phát tiếp đúng vị trí tính theo giờ server.
  - Có 2 phút kiểm tra lại ở cuối.
- **Đề Full:** làm Listening trước, sau đó chuyển sang Reading.
- **Thanh điều hướng dưới:** tab Part, ô số câu hiển thị trạng thái đã làm / đánh dấu Review, nút câu trước / câu sau.
- **Đồng hồ:** cảnh báo lúc còn 10 phút và 5 phút, hết giờ thì tự nộp. Có hộp xác nhận khi nộp bài.
- **Tự lưu:** chỉ báo trạng thái lưu. Mất mạng thì hiện "Mất kết nối" và tự lưu lại khi có mạng. Hỏi xác nhận khi rời trang.
- **Trang kết quả:** điểm, band, từng câu (đáp án của mình và đáp án đúng), lọc câu sai, nút **"Mở bài đọc trong Trình đọc"** (tạo `Document` nguồn `exam` → `/read/[id]`).
  - Nút **Giải thích** ở mỗi câu mở ngăn bên: giải thích từ file đề (ghi "Từ file đề"), hoặc *(Nên có)* giải thích do AI tạo kèm bằng chứng tô sáng trong bài (ghi "Do AI tạo, có thể chưa chính xác").
  - Listening có nút **Xem transcript** theo từng Part (nếu đề có transcript).

**Hoàn thành khi:**
- Tab Theo mẫu: tải bộ file mẫu đúng quy định thì ra đề làm được. Bộ file thiếu đáp án thì bị từ chối, kèm thông báo câu nào thiếu.
- Tab AI nhận diện: thả lần lượt các file của một đề (kể cả một PDF duy nhất có đáp án ở cuối) thì bảng Độ đầy đủ báo đúng thành phần nào đã có, thành phần nào còn thiếu. Đủ thì ra đề làm được.
- Payload cho thí sinh không lộ đáp án, giải thích hay transcript Listening (có test).
- Refresh giữa giờ thì không mất bài, đồng hồ không bị reset.
- Nộp bài hai lần thì kết quả không đổi. Người khác xem kết quả thì bị 403.

## C5. `library` — Kho cộng đồng

- **Đăng lên / gỡ xuống:** `POST /library/{sets|tests}/:id/publish` và `.../unpublish`, chỉ chủ sở hữu được làm. Đặt `visibility` qua public API của module sở hữu nội dung.
- **Duyệt:** `GET /library?type=set|test&q=&topic=&skill=&sort=new|popular`, có phân trang.
- **Xem trước:**
  - Bộ thẻ: toàn bộ thẻ.
  - Đề: tiêu đề, kỹ năng, số câu, thời gian, các dạng câu, người đăng, số lượt làm. **Không** lộ câu hỏi chi tiết hay đáp án.
- **Dùng nội dung:**
  - Bộ thẻ: `POST /library/sets/:id/copy` chép sâu vào thư viện của mình, ghi `copiedFromId`, tăng `copyCount`. Sửa bản chép không ảnh hưởng bản gốc.
  - Đề: làm trực tiếp (`POST /attempts` với đề công khai), không cần chép.
- **Báo cáo:** `POST /library/reports` với lý do (sai nội dung, bản quyền, không phù hợp). Một đề hoặc bộ thẻ có từ 3 báo cáo trở lên thì tự ẩn khỏi kho, chờ chủ sở hữu xử lý.
- **Giao diện:** `/library` có hai tab Bộ thẻ / Đề thi, ô tìm kiếm, bộ lọc. Có trang xem trước. Có nút Đăng lên / Gỡ xuống ngay trên trang của chủ sở hữu.
- **Hoàn thành khi:**
  - Nội dung riêng tư không xuất hiện trong kho và không truy cập được qua URL.
  - Bản chép độc lập với bản gốc.
  - Không ai đăng hay gỡ được nội dung của người khác.

## C6. `stats` — Dashboard cá nhân

Trang `/dashboard`, **chỉ chủ tài khoản xem được**. Tinh thần giống trang hồ sơ GitHub: nhìn một lần là thấy quá trình học.

| Widget | Dữ liệu |
|---|---|
| **Lịch hoạt động** (ô màu 52 tuần) | Số hoạt động mỗi ngày: tra từ, lưu từ, ôn thẻ, làm bài. Kèm chuỗi ngày học hiện tại và dài nhất |
| **Thẻ số liệu** | Số bài đã thi, band cao nhất và gần nhất theo kỹ năng, tổng số từ, số từ đã thuộc, số thẻ đã ôn, tổng thời gian học |
| **Xu hướng band** | Đường band Reading và Listening theo thời gian, kèm vạch mục tiêu band |
| **Vốn từ** | Số từ tăng thêm theo tuần, tỉ lệ Mới / Đang học / Đã thuộc |
| **Điểm yếu** | Tỉ lệ đúng theo từng dạng câu, đánh dấu dạng câu yếu nhất kèm gợi ý luyện tập |
| **Chủ đề** | Các chủ đề từ vựng học nhiều nhất |
| **Cộng đồng** | Số bộ thẻ và đề đã đăng, số lượt người khác chép về hoặc làm |

- **API:** `GET /stats/overview`, `/stats/activity?from&to`, `/stats/bands`, `/stats/vocab`, `/stats/weaknesses`, `/stats/community`. Dữ liệu tổng hợp qua public API của từng module, ngày tính theo giờ Việt Nam.
- **Hoàn thành khi:**
  - Tài khoản demo hiển thị đủ mọi widget.
  - Tài khoản mới có trạng thái trống ở mọi widget.
  - Biểu đồ có `aria-label` và có bảng số liệu thay thế cho trình đọc màn hình.

## C7. Trang chủ

`/home` ghép widget từ home widget registry:
- Tiếp tục bài thi đang làm.
- Số thẻ đến hạn hôm nay.
- Tài liệu đọc gần đây.
- Chuỗi ngày học.
- Lối tắt: Đọc tài liệu mới, Tải đề, Vào kho.

---

# Phần D — Backlog theo giai đoạn

**Cách dùng với Kanban** (Working_rules mục 6):
- Mỗi dòng là **một Issue = một PR**. Tiêu đề Issue bắt đầu bằng mã, ví dụ `[P2-06] Trình đọc: chọn từ và tra từ`.
- Nạp hết vào **Backlog** theo đúng thứ tự trong bảng. Thứ tự này cũng là thứ tự ưu tiên trong cột **Ready**. Issue nào có đủ các việc **Cần trước** đã merge thì chuyển sang Ready, và kéo được ngay, không phải chờ các dòng phía trên.
- **Phụ trách** là người nên kéo thẻ: **KH** = Khai Hung, **TH** = Tien Hung.
- **Cỡ:** S ≈ dưới nửa ngày, M ≈ một ngày, L ≈ hơn một ngày. Thẻ cỡ L nên tách thành 2–3 PR khi làm.
- Giai đoạn là mốc để đối chiếu tiến độ trong buổi xem lại tuần. Giai đoạn không phải sprint: xong việc thì kéo việc tiếp theo, không chờ hết giai đoạn.
- Việc đánh dấu **(Nên có)** đứng cuối Ready của giai đoạn đó và bị cắt đầu tiên khi trễ.
- Bảng chỉ liệt kê việc đã biết trước. Review PR, issue `bug` và việc phát sinh xử lý theo Working_rules mục 6.3 – 6.4.

## Giai đoạn 0 — Phân tích, thiết kế & chuẩn bị (T3 03/11 – T5 05/11)

Hai luồng chạy song song: **thiết kế** (sơ đồ, CSDL, wireframe, quy ước ở B6) và **khung code**. Thiết kế phải được duyệt trước khi bắt đầu các issue DB và giao diện của từng module.

| Mã | Công việc | Module | Phụ trách | Cỡ | Cần trước | Hoàn thành khi |
|---|---|---|---|---|---|---|
| P0-01 | Board GitHub Projects: 5 cột, các trường (Priority, Module, Cỡ, Mã), 4 view, workflow tự động; tạo labels | quản lý | KH | S | — | Board đúng Working_rules mục 6.1; mọi issue đã có trên board |
| P0-02 | Thêm TH làm collaborator; cấu hình bảo vệ `main` (nếu repo private thì ghi rõ là tuân thủ thủ công) | quản lý | KH | S | — | TH push được branch; luật merge được ghi trong README |
| P0-03 | Sơ đồ use case tổng (actor, toàn bộ use case theo module) + use case chi tiết và đặc tả cho vocab, flashcard, exam | thiết kế | KH | M | — | Sơ đồ và đặc tả đúng mẫu B6; cả nhóm duyệt trong PR |
| P0-04 | Use case chi tiết và đặc tả cho auth, library, stats | thiết kế | KH | S | P0-03 | Như trên |
| P0-05 | **Thiết kế CSDL:** ERD toàn hệ thống + từ điển dữ liệu (bảng, cột, kiểu, khóa, ràng buộc duy nhất, bảng thuộc module nào) | thiết kế | KH | M | P0-03, P0-04 | Mọi bảng ở B1 có mặt; TH duyệt; các issue DB sau chỉ hiện thực ERD này |
| P0-06 | Activity: Đọc → tra → lưu từ; Tạo / sửa bộ thẻ và học | thiết kế | KH | S | P0-03 | Có luồng lỗi (hết quota AI, file sai) |
| P0-07 | Activity: Tải đề; Làm bài thi (tự lưu, hết giờ, nộp); Đăng lên và chép từ kho | thiết kế | KH | S | P0-04 | Có luồng lỗi (đề sai quy định, mất mạng, quá hạn) |
| P0-08 | Sequence: Tra từ và Lọc nhanh qua AI gateway (cache, quota, retry) | thiết kế | KH | S | P0-05 | Khớp tên endpoint ở Phần C |
| P0-09 | Sequence: Đăng nhập; Tải đề (job nền → AI → kiểm tra → lưu); Làm bài, tự lưu, nộp; Chép bộ thẻ | thiết kế | KH | M | P0-05 | Khớp tên endpoint ở Phần C |
| P0-10 | State: `Attempt`, `TestImport`, trạng thái công khai của nội dung, tiến độ thẻ (Mới → Đang học → Đã thuộc) | thiết kế | KH | S | P0-05 | Mọi trạng thái và điều kiện chuyển đều có |
| P0-11 | Component + deployment (local và online) + class diagram kiến trúc module và các registry (B3, B4) | thiết kế | KH | S | — | Khớp Phần B và Phần E |
| P0-12 | Wireframe các màn chính: trình đọc, trình soạn thẻ, chế độ học, phòng thi Reading / Listening, kết quả, dashboard | thiết kế | KH | M | P0-03 | Có bản 375px và 1440px; phòng thi đối chiếu với thi máy thật |
| P0-13 | Khung monorepo: npm workspaces (`client`, `server`, `shared`), TypeScript, gts (dòng tối đa 120 ký tự), `.editorconfig`, `.nvmrc`, `.gitignore`, script gốc `dev`, `lint`, `fix`, `test`, `build` | core | KH | M | — | `npm install` và `npm run lint` chạy được ở gốc |
| P0-14 | `docker-compose.yml`: Postgres cho `dev` và `test`; `.env.example` | core | KH | S | P0-13 | `docker compose up` xong là kết nối được DB |
| P0-15 | Khung client: Next.js App Router, Tailwind, shadcn, theme tokens, font Be Vietnam Pro, `next-intl` (vi/en), 3 nhóm layout trống | core/client | KH | M | P0-13 | `npm run dev` hiện trang tạm, đổi được ngôn ngữ |
| P0-16 | Khung server: Express, validate biến môi trường bằng Zod, `GET /api/v1/health` | core/server | KH | S | P0-13 | Gọi health trả về `ok` |
| P0-17 | CI GitHub Actions: cài đặt, lint, kiểm tra kiểu, test, build cho 3 workspace; có Postgres service; cache npm | core | KH | M | P0-15, P0-16 | PR mẫu chạy CI xanh |
| P0-18 | Template PR và Issue (Task / Bug / Idea); bật Discussions mục *Meetings* | quản lý | KH | S | — | Mở PR hay Issue mới hiện đúng template |
| P0-19 | Lấy Gemini API key; chuẩn bị bộ file đề thật mà nhóm có quyền dùng: 1 Reading, 1 Listening (+ audio), 1 Full (Phần F) | content | KH | S | — | Có đủ file, lưu ngoài repo. **Đường găng của P3-05** |
| P0-20 | Cập nhật `Project_Structure.md`, `Working_rules.md` theo PLAN này (Phần H mục 4) | docs | KH | S | — | Không còn chỗ mâu thuẫn với PLAN |

## Giai đoạn 1 — Nền móng (T5 05/11 – T7 07/11)

| Mã | Công việc | Module | Phụ trách | Cỡ | Cần trước | Hoàn thành khi |
|---|---|---|---|---|---|---|
| P1-01 | Lỗi chuẩn, middleware xử lý lỗi, middleware validate Zod, bọc handler async | core/server | TH | S | P0-16 | Có test cho lỗi Zod và lỗi không lường trước |
| P1-02 | Module registry + Swagger registry; `/docs`, `/docs/openapi.json`; test route-coverage | core/server | TH | M | P1-01 | Thêm route chưa có doc thì test báo lỗi |
| P1-03 | Prisma: schema chia file theo module, client dùng chung, script `db:migrate`, `db:seed`; CI chạy migrate | core/server | KH | M | P0-14, P0-17 | Migration đầu tiên chạy được ở local và trong CI |
| P1-04 | Bảo mật: helmet, CORS, rate limit chung, giới hạn body; ký và xác minh JWT; `requireAuth` | core/server | TH | S | P1-01 | Thiếu token thì 401 (có test) |
| P1-05 | DB auth: bảng `User` theo ERD | auth | KH | S | P1-03, P0-05 | Migration đã merge |
| P1-06 | Auth server: 4 endpoint (C1), rate limit đăng nhập, Swagger, test | auth | TH | M | P1-02, P1-04, P1-05 | Đạt test của C1 |
| P1-07 | Lưu file: interface `storage`, driver `local`, kiểm tra MIME và kích thước; test | core/server | TH | S | P1-01 | Upload và đọc lại được file; sai MIME thì 415 |
| P1-08 | AI gateway: Gemini client, `runJsonTask`, AI task registry, `AiCache`, `AiUsage`, quota, retry, đầu vào là PDF, bản mock | core/server | KH | M | P1-03 | Test với mock: cache trúng, quá quota ra 429, JSON sai thì thử lại |
| P1-09 | Client core: API client, lỗi có kiểu (mã lỗi → câu đã dịch), phiên đăng nhập, chặn trang cần đăng nhập | core/client | KH | M | P0-15 | Chưa đăng nhập vào `/home` thì bị chuyển về `/login?next=/home` |
| P1-10 | Khung giao diện: navbar từ nav registry, nút đổi ngôn ngữ, toast, 404/lỗi, skeleton, trạng thái trống | core/client | KH | M | P0-15, P0-12 | Hiển thị đúng ở 375px và 1440px |
| P1-11 | Auth client: `/login`, `/register`, `/profile`, đăng xuất | auth | KH | M | P1-06, P1-09 | Đạt "Hoàn thành khi" của C1 ở local |
| P1-12 | Trang landing `/` (song ngữ) | core/client | KH | S | P1-10 | Responsive; nút dẫn tới đăng nhập và đăng ký |
| P1-13 | DB core theo ERD: `AiCache`, `AiUsage`, `StoredFile` (phát sinh 04/11: bảng exam cần `StoredFile` trước P1-07) | core/server | KH | S | P1-05 | Migration đã merge |

## Giai đoạn 2 — `vocab` + `flashcard` lõi (CN 08/11 – T3 10/11) → `v0.1`

| Mã | Công việc | Module | Phụ trách | Cỡ | Cần trước | Hoàn thành khi |
|---|---|---|---|---|---|---|
| P2-01 | DB vocab + flashcard theo ERD: `Document`, `VocabEntry`, `FlashcardSet`, `Card`, `CardProgress`, `StudySession` | vocab, flashcard | KH | M | P1-05, P0-05 | Migration đã merge |
| P2-02 | Server vocab: tài liệu (dán văn bản / file PDF, DOCX, TXT → chữ), danh sách, chi tiết, xóa; Swagger; test quyền sở hữu | vocab | TH | M | P2-01, P1-06 | Đọc đúng chữ từ 3 loại file mẫu |
| P2-03 | Task AI `explain-word.v1` + `POST /vocab/lookups` (không phụ thuộc giao diện web) | vocab | KH | M | P1-08, P2-01 | Cùng một từ ở hai câu khác nghĩa ra hai nghĩa khác nhau (test với mock) |
| P2-04 | Server vocab: CRUD kho từ, gộp từ trùng, tìm kiếm và lọc; Swagger; test | vocab | TH | M | P2-01, P1-06 | Đạt test; doc hiển thị đủ |
| P2-05 | Task AI `scan-document.v1` + `POST /vocab/documents/:id/scan` (lọc theo CEFR / chủ đề, loại câu bịa) | vocab | KH | M | P2-02, P2-03 | Câu ví dụ bịa bị loại (có test) |
| P2-06 | Client: `/read`, `/read/[id]`: trình đọc, chọn từ → popover giải thích → lưu, tô lại từ đã lưu | vocab | KH | L | P2-02, P2-03, P2-04 | Tra và lưu được bằng chuột và bàn phím |
| P2-07 | Client: bảng lọc nhanh trong trình đọc + `/vocab` kho từ (lọc, xóa, chọn → tạo bộ thẻ) | vocab | KH | M | P2-05, P2-06 | Lưu đúng các từ được chọn |
| P2-08 | Server flashcard: CRUD bộ thẻ, `PUT .../cards`, tạo bộ thẻ từ kho từ; Swagger; test quyền sở hữu | flashcard | TH | M | P2-01, P2-04 | Sửa bộ thẻ không làm mất tiến độ của thẻ còn giữ |
| P2-09 | Server flashcard: scheduler SM-2, giới hạn mỗi ngày theo giờ Việt Nam, `study`, `reviews`, `sessions`, `GET /flashcards/due-summary` (tổng thẻ đến hạn mọi bộ, cho trang chủ); unit test | flashcard | TH | M | P2-08 | Đạt mọi unit test SM-2 |
| P2-10 | Client flashcard: `/flashcards`, trình soạn tạo / sửa (thêm, xóa, đổi thứ tự), trang xem trước bộ thẻ | flashcard | KH | M | P2-08 | Tạo, sửa, xóa được bộ thẻ |
| P2-11 | Client flashcard: chế độ Thẻ lật + Học (SM-2), phím tắt, tổng kết phiên | flashcard | KH | M | P2-09, P2-10 | Ôn hết phiên chỉ bằng bàn phím |
| P2-12 | Seed / mock: tài khoản demo, tài liệu, kho từ, bộ thẻ, tiến độ | core | KH | S | P2-04, P2-08 | `db:seed` chạy lại nhiều lần không lỗi |
| P2-13 | Kiểm tra vòng Đọc → Tra → Lưu → Bộ thẻ → Học ở local; tag `v0.1`, release notes, ảnh chụp | quản lý | TH | S | P2-07, P2-11 | Release có trên GitHub |

## Giai đoạn 3 — `exam` + deploy (T3 10/11 – T6 13/11) → `v0.2`

| Mã | Công việc | Module | Phụ trách | Cỡ | Cần trước | Hoàn thành khi |
|---|---|---|---|---|---|---|
| P3-01 | Shared: certification registry (IELTS) + question kind registry (schema đáp án, chuẩn hóa, chấm) + bảng band; unit test | exam | TH | M | P0-13 | Test chấm của mọi dạng câu đạt |
| P3-02 | DB exam theo ERD: `Test`, `TestSection`, `Passage`, `QuestionGroup`, `Question`, `TestImport`, `Attempt`, `AttemptAnswer` | exam | KH | M | P1-05, P0-05 | Migration đã merge |
| P3-03 | Seed đề mẫu dạng cấu trúc (từ file đề thật ở P0-19), để làm phòng thi mà không phải chờ luồng tải đề | exam | KH | S | P3-02, P3-01, P0-19 | `db:seed` có ít nhất 1 đề Reading và 1 đề Listening làm được |
| P3-04 | Server import (phần không AI): `POST`/`DELETE /tests/imports/files`, `POST /tests/imports` (gộp PDF, không đổi schema), `GET /tests/imports/:id`; `buildChecklist` trong `shared/exam`; lưu file, job nền, dọn file mồ côi | exam | TH | M | P3-02, P1-07 | Thiếu thành phần bắt buộc thì `POST /tests/imports` trả 422 kèm bảng Độ đầy đủ; không có migration mới |
| P3-05 | Task AI `classify-pages.v1` (nhãn từng trang + khoảng số câu) + `parse-test.v1` + `parse-answers.v1` (đáp án và giải thích theo câu, tự nhận ra đáp án thuộc phần nào) + lấy transcript; test bằng các PDF thật ở P0-19 | exam | KH | L | P1-08, P3-01, P0-19 | Cả 3 bộ file mẫu ra đúng cấu trúc, đúng đáp án; một PDF có đáp án ở cuối được tách đúng |
| P3-06 | Server import: ghép kết quả của P3-05 vào job, tính bảng Độ đầy đủ, lớp kiểm tra trước khi lưu (C4 bước 4, chia lỗi chặn / cảnh báo) + ghi đề riêng tư | exam | TH | M | P3-04, P3-05 | Tải bộ file mẫu ra đề làm được; thiếu hoặc sai đáp án bị báo đúng số câu; thiếu giải thích chỉ ra cảnh báo |
| P3-07 | Server: `GET /tests`, `GET /tests/:id` (không lộ đáp án, giải thích, transcript), `PATCH`, `DELETE` (chặn xóa khi đã có người khác làm); Swagger; test | exam | TH | S | P3-03 | Có test payload không chứa đáp án, giải thích và transcript; xóa đề có `attemptCount > 0` trả 409 |
| P3-08 | Server attempts: tạo / tiếp tục, `GET` (có `serverNow`, nộp lười, vị trí audio), **phát audio theo luồng** (không cho tải, không cho tua), tự lưu (từ chối khi quá hạn), nộp và chấm, kết quả, lịch sử; Swagger; test | exam | TH | L | P3-07 | Nộp hai lần không đổi kết quả; người khác bị 403 |
| P3-09 | **Deploy lên subdomain miễn phí (T4 11/11):** server lên Render (chạy `migrate deploy` trước khi start), DB Neon, client lên Vercel, driver lưu file `r2`, biến môi trường, UptimeRobot | deploy | TH | M | P2-13 | Đăng nhập và vòng `v0.1` chạy được online |
| P3-10 | Client "Thi thử": `/tests` (đề của tôi), màn tải đề hai tab theo wireframe (AI nhận diện: thả file, nhãn trang, bảng Độ đầy đủ; Theo mẫu: ô theo loại đề), tiến độ xử lý, lỗi theo câu, cảnh báo | exam | KH | M | P3-04, P3-07 | Cả hai tab: tải lên → chờ → ra đề trong danh sách |
| P3-11 | Client: trang thông tin đề (Bắt đầu / Tiếp tục) + các màn trước khi thi như thi máy thật (xác nhận thông tin, hướng dẫn, kiểm tra âm thanh với Listening) | exam | KH | M | P3-08 | Bấm Bắt đầu → qua các màn → vào phòng thi |
| P3-12 | Client phòng thi — khung: header, đồng hồ theo giờ server, cảnh báo, Settings (cỡ chữ, tương phản), thanh điều hướng dưới, đánh dấu Review, xác nhận nộp bài, tự lưu + chỉ báo, chặn rời trang | exam | KH | L | P3-08 | Refresh không mất gì; mất mạng thì hiện "Mất kết nối" và tự lưu lại khi có mạng |
| P3-13 | Client phòng thi — Reading: chia cột kéo được, component các dạng câu, highlight + ghi chú, gạch bỏ phương án | exam | KH | L | P3-12 | Mọi dạng câu trong đề mẫu hiển thị và lưu được; highlight còn sau khi refresh |
| P3-14 | Client phòng thi — Listening: trình phát không dừng, không tua, âm lượng, phát tiếp đúng vị trí, 2 phút kiểm tra lại, tự nộp; đề Full chạy Listening → Reading | exam | KH | M | P3-13 | Refresh khi đang nghe thì phát tiếp đúng vị trí |
| P3-15 | Server vocab: nguồn `exam` (tạo tài liệu từ passage của bài đã nộp, qua public API của exam); test | vocab | TH | S | P3-08, P2-02 | Chưa nộp bài mà tạo tài liệu thì bị 403 |
| P3-16 | Client: trang kết quả (điểm, band, từng câu, lọc câu sai, giải thích từ file đề, transcript Listening, "Mở bài đọc trong Trình đọc") | exam | KH | M | P3-08, P3-15 | Từ kết quả mở được bài đọc trong trình đọc |
| P3-18 | *(Nên có)* Task AI `parse-audio.v1` (transcript và mốc từng Part khi bộ file không có transcript) + cắt hình bản đồ / sơ đồ từ PDF theo tọa độ AI trả về | exam | KH | M | P3-05, P3-06 | Đề Listening không kèm transcript vẫn có transcript sau khi tải; nhóm câu `diagram_label` có ảnh |
| P3-17 | Kiểm tra online; tag `v0.2`, release notes, ảnh chụp | quản lý | TH | S | P3-06, P3-09, P3-14, P3-16 | Release có trên GitHub |

## Giai đoạn 4 — `library`, `stats`, trang chủ (T7 14/11 – T2 16/11)

| Mã | Công việc | Module | Phụ trách | Cỡ | Cần trước | Hoàn thành khi |
|---|---|---|---|---|---|---|
| P4-01 | DB library theo ERD: `visibility`, `publishedAt`, `copiedFromId`, các bộ đếm trên `FlashcardSet` / `Test`; bảng `Report` | library | KH | S | P2-01, P3-02 | Migration đã merge |
| P4-02 | Server library: đăng lên / gỡ xuống, duyệt kho (tìm kiếm, lọc, sắp xếp), xem trước, chép bộ thẻ, cho làm đề công khai, báo cáo + tự ẩn; Swagger; test | library | TH | L | P4-01, P3-08 | Nội dung riêng tư không lộ (có test); bản chép độc lập với bản gốc |
| P4-03 | Client: `/library` (2 tab, tìm kiếm, lọc), trang xem trước, chép / làm bài, báo cáo, nút đăng lên / gỡ xuống ở trang của chủ sở hữu | library | KH | M | P4-02 | Đạt "Hoàn thành khi" của C5 |
| P4-04 | Server stats: 6 endpoint (C6), tính chuỗi ngày học; public API thống kê ở các module; test với dữ liệu seed. Widget Cộng đồng làm sau cùng, khi P4-02 đã merge | stats | TH | M | P3-08, P2-09 | Đạt test |
| P4-05 | Seed lịch sử demo: bài thi, lượt ôn, từ tra trải đều 6 tuần; nội dung cộng đồng mẫu | core | KH | S | P4-02 | Dashboard của tài khoản demo đầy đủ số liệu |
| P4-06 | Client: `/dashboard` (dashboard widget registry, 7 widget, `aria-label`, trạng thái trống) | stats | KH | M | P4-04 | Đạt "Hoàn thành khi" của C6 |
| P4-07 | Client: `/home` ghép đủ widget | core/client | KH | S | P4-06 | Đủ widget, mỗi widget có trạng thái trống |
| P4-08 | E2E Playwright: đăng nhập → đọc → tra → lưu → bộ thẻ → học; tải đề (AI mock) → làm bài → nộp → kết quả; chạy trong CI | core | TH | M | P3-16, P2-11 | Test xanh trong CI |
| P4-09 | (Nên có) Server flashcard: `GET .../quiz` sinh câu hỏi Kiểm tra từ bộ thẻ; test | flashcard | TH | S | P2-09 | Đạt test |
| P4-10 | (Nên có) Client flashcard: chế độ Kiểm tra, Ghép thẻ, dán nhanh nhiều thẻ | flashcard | KH | M | P4-09, P2-11 | Chạy được 2 chế độ mới |
| P4-11 | (Nên có) Task AI `generate-exercise.v1` + `POST /flashcards/sets/:id/exercises` + màn Luyện tập AI | flashcard | KH | M | P2-09 | Câu hỏi sai định dạng hoặc dùng từ ngoài bộ thẻ bị loại (có test) |
| P4-12 | (Nên có) Task AI `explain-answer.v1` + `POST /attempts/:id/questions/:no/explain` + ngăn giải thích trên trang kết quả | exam | KH | M | P3-16 | Bằng chứng được tô sáng đúng chỗ trong bài; câu có giải thích từ file thì không gọi AI |

## Giai đoạn 5 — Đóng băng & hoàn thiện (T3 17/11 – T4 18/11) → `v1.0`

**Từ T3 17/11 không thêm tính năng mới.** Issue mới chỉ được là `bug` hoặc việc hoàn thiện.

| Mã | Công việc | Module | Phụ trách | Cỡ | Cần trước | Hoàn thành khi |
|---|---|---|---|---|---|---|
| P5-01 | Rà a11y & responsive mọi trang (bàn phím, focus, tương phản, 375px), cả hai ngôn ngữ; sửa lỗi | toàn client | KH | M | — | Không còn lỗi mức nghiêm trọng; không còn chuỗi chưa dịch |
| P5-02 | Rà bảo mật: quyền sở hữu ở mọi endpoint, nội dung riêng tư, không lộ đáp án, rate limit, giới hạn upload, header | toàn server | TH | M | — | Checklist ghi trong PR |
| P5-03 | Hiệu năng: index DB, truy vấn chậm, kích thước bundle, font / ảnh | toàn bộ | TH | S | — | Các trang chính tải nhanh trên môi trường online |
| P5-04 | Rà Swagger: mọi endpoint có ví dụ, mã lỗi, mô tả rõ ràng | toàn server | TH | S | — | Đọc `/docs` hiểu được mà không cần xem code |
| P5-05 | E2E bổ sung: library, dashboard, Listening | core | TH | M | P4-08 | Xanh trong CI |
| P5-06 | Gắn tên miền (nếu đã mua) + HTTPS qua Cloudflare; cập nhật README | deploy | TH | S | P3-09 | Web và API chạy trên tên miền |
| P5-07 | Kiểm tra toàn bộ online; sinh lại ERD từ Prisma và đối chiếu bộ sơ đồ (B6); chụp snapshot DB; tag `v1.0`, release notes | quản lý | KH | S | P5-01 → P5-05 | Release `v1.0`; sơ đồ khớp với code |

## Giai đoạn 6 — Report, thuyết trình, bảo trì (T5 19/11 – CN 22/11)

Report dùng lại bộ sơ đồ của Giai đoạn 0 (đã được cập nhật theo code), nên giai đoạn này chỉ cần 4 ngày.

| Mã | Công việc | Phụ trách | Thời hạn | Hoàn thành khi |
|---|---|---|---|---|
| P6-01 | Report phần 1: tổng quan, lý do, khảo sát, use case, kiến trúc, tech stack, giao diện | KH | T6 20/11 | Bản nháp đủ mục |
| P6-02 | Report phần 2: ERD, activity / sequence / state, API (ảnh Swagger), quy trình Kanban (board, Insights, PR, release), deploy, việc dùng AI | TH | T6 20/11 | Bản nháp đủ mục |
| P6-03 | Slide + kịch bản demo theo vòng học | KH | T6 20/11 | Tập dượt một lần |
| P6-04 | Quay video demo dự phòng | TH | T7 21/11 | Video đủ vòng học |
| P6-05 | Sửa lỗi phát hiện khi tập dượt (`fix/...`, tag `v1.0.x`) | cả hai | T7 21/11 | Không còn lỗi nghiêm trọng |
| P6-06 | Checklist trước khi nộp (Working_rules mục 16), nộp bài | cả hai | CN 22/11 | Đã nộp |

## Cân đối số issue

| Giai đoạn | Tổng | KH | TH |
|---|---|---|---|
| 0 | 20 | 20 | 0 |
| 1 | 13 | 8 | 5 |
| 2 | 13 | 8 | 5 |
| 3 | 18 | 10 | 8 |
| 4 (gồm Nên có) | 12 | 8 | 4 |
| 5–6 | 13 | 4 (+2 chung) | 7 (+2 chung) |
| **Tổng** | **89** | **58 (+2)** | **29 (+2)** |

Thẻ của KH nặng hơn về khối lượng, nhất là các thẻ L phía client ở Giai đoạn 3. KH nên tách mỗi thẻ L thành 2–3 PR để giữ nhịp tối thiểu 1 PR mỗi ngày.

---

# Phần E — Môi trường & deploy

| Môi trường | Thành phần | Ghi chú |
|---|---|---|
| **Local** | Postgres trong Docker (`docker-compose.yml`), lưu file vào `uploads/`, AI dùng key riêng hoặc mock | Mặc định khi phát triển |
| **CI** | Postgres service của GitHub Actions, AI luôn mock | Không gọi Gemini thật trong CI |
| **Online (từ T4 11/11)** | Client trên **Vercel** (`*.vercel.app`, có preview cho mỗi PR); server trên **Render** (`*.onrender.com`); DB **Neon**; file trên **Cloudflare R2** | Build server xong thì chạy `prisma migrate deploy` rồi mới start. Health check `/api/v1/health` |
| **Tên miền** | **[CẦN CHỐT]** chưa mua. Khi mua: `<tên-miền>` → Vercel, `api.<tên-miền>` → Render, HTTPS qua Cloudflare | Việc P5-06 |

- **Theo dõi:** UptimeRobot ping 5 phút một lần (đồng thời giữ Render không "ngủ"), có trang status công khai.
- **Rollback:** Vercel thì *Promote* bản deploy trước. Render thì deploy lại commit trước. Migration chỉ thêm (B5) nên DB không cần rollback.
- **Secret:** chỉ lưu trong cài đặt của Vercel / Render và GitHub Secrets. Danh sách tên biến nằm trong `.env.example`.

---

# Phần F — Quy định file đề tải lên

Màn tải đề có **hai tab**. Cả hai đều ra cùng một cấu trúc đề và qua cùng lớp kiểm tra (C4 bước 4). Chỉ khác ở việc **ai xác định vai trò của từng file**. Tab **AI nhận diện** mở mặc định. Wireframe: `Analysis_Design/07_Wireframe/05-exam/upload.html`.

### Tab Theo mẫu
Dành cho người đã có sẵn bộ file đúng mẫu. Người dùng chọn loại đề, rồi đặt mỗi file vào đúng ô của nó. Trang hiển thị hướng dẫn kèm file mẫu.

| Loại đề | Ô bắt buộc | Ô tùy chọn | Ghi chú |
|---|---|---|---|
| **Reading** | Đề (PDF) + Đáp án (PDF) | Giải thích (PDF) | 3 passage, 40 câu |
| **Listening** | Đề (PDF) + Audio + Đáp án (PDF) | Transcript (PDF), Giải thích (PDF) | 4 part, 40 câu; một file audio cho cả bài |
| **Full** | Đề (PDF, gồm Listening và Reading) + Audio + Đáp án (PDF) | Transcript (PDF), Giải thích (PDF) | Hệ thống tự nhận ra đáp án nào thuộc Listening, đáp án nào thuộc Reading |

- Một file chứa nhiều phần (ví dụ đề có đáp án và giải thích ở cuối) thì **chọn cùng file đó cho nhiều ô**. Hệ thống gắn nhãn trang để mỗi ô chỉ lấy đúng phần của mình.
- Thiếu ô bắt buộc hoặc sai định dạng thì bị từ chối **ngay khi gửi**, chưa tốn lượt gọi AI.

### Tab AI nhận diện
Dành cho người chỉ có một đống file, không biết hoặc không muốn chia ô. Cách dùng giống như thả file vào một khung chat AI.

- **Một ô kéo thả**, nhận nhiều file. Thả thêm dần hoặc bỏ từng file được. Không cần chọn loại đề, không cần đặt tên file theo mẫu.
- Mỗi file vừa thả vào thì được nhận diện ngay: PDF được gắn nhãn từng trang (đề, câu hỏi, đáp án, giải thích, transcript, không liên quan), audio được đọc độ dài.
- Bên cạnh ô thả file là **bảng Độ đầy đủ**, tính lại sau mỗi file:

| Thành phần | Bắt buộc | Hiển thị, ví dụ |
|---|---|---|
| Bài đọc / Part | ✓ | "Reading: 3/3 passage" |
| Câu hỏi | ✓ | "Listening: câu 1–40" |
| Đáp án | ✓ | "Đủ 40/40" hoặc "Thiếu câu 12, 27" |
| Audio | ✓ với Listening, Full | "31:20" |
| Giải thích | | "Có cho 40/40 câu" hoặc "Không có, sau này dùng AI giải thích" |
| Transcript | | "Có cho Part 1–4" |

- **Loại đề do hệ thống suy ra** từ các kỹ năng tìm thấy (chỉ Reading, chỉ Listening, hay cả hai), người dùng đổi lại được.
- File không nhận ra là đề IELTS thì đánh dấu **Không dùng** và bỏ qua, không làm hỏng cả lượt.
- Nút **Tạo đề** chỉ bật khi đủ các thành phần bắt buộc.
- Bảng này là **kiểm tra sơ bộ** dựa trên nhãn trang. Kiểm tra chính xác từng câu vẫn chạy sau khi trích nội dung, nên bảng báo đủ mà bước kiểm tra vẫn có thể báo lỗi theo câu.

### Ràng buộc file (cả hai tab)
- PDF có lớp chữ được khuyến nghị. PDF scan vẫn nhận, nhưng độ chính xác thấp hơn. Tối đa 20 MB mỗi file.
- Audio dạng MP3 hoặc M4A, tối đa 60 MB.
- Tối đa 10 file mỗi lượt tải.
- Đáp án đánh số câu rõ ràng. Đáp án có nhiều cách viết thì phân tách bằng `/` hoặc `OR`. Phần chữ tùy chọn để trong ngoặc, ví dụ `(the) library`.
- Giải thích và transcript không bắt buộc. Thiếu thì đề vẫn được tạo, kèm cảnh báo.

**Cấu trúc sau khi nhận diện** (schema trong `shared/exam`, đây là nguồn sự thật):
- `Test`: chứng chỉ, loại, tiêu đề, danh sách `sections[]`.
- `Section`: kỹ năng, thời gian, `passages[]` (Reading: tiêu đề, các đoạn có nhãn A, B, C…) hoặc audio và transcript nếu có (Listening, lưu trong `paragraphs`), `groups[]`.
- `Group`: khoảng câu (ví dụ 1–5), hướng dẫn, dạng câu, phương án dùng chung, giới hạn số từ, `questions[]`.
- `Question`: số câu, nội dung (có chỗ trống), phương án riêng (nếu có), đáp án đúng (một hoặc nhiều cách viết) kèm giải thích nếu có.

**Nội dung đề:** mỗi đề phải ghi rõ nguồn. **Không** đăng lên kho chung đề có bản quyền khi chưa được phép. Đề dùng để demo do nhóm tự chuẩn bị (P0-19). AI Agent không soạn nội dung đề.

---

# Phần G — Rủi ro & thứ tự cắt giảm

| Rủi ro | Phòng ngừa | Nếu xảy ra |
|---|---|---|
| **AI tách PDF đề sai** | Tab Theo mẫu cho bộ file chuẩn; tab AI có bảng Độ đầy đủ báo thiếu trước khi chạy; lớp kiểm tra trước khi lưu; test bằng PDF thật từ sớm (P3-05) | Báo lỗi theo từng câu để người dùng sửa file. Demo bằng đề đã được kiểm tra trong seed |
| **KH quá tải** (toàn bộ FE + DB + AI) | CI, deploy, e2e, rà soát server chuyển cho TH; thẻ L tách nhỏ | Cắt theo thứ tự bên dưới; TH nhận thêm test e2e và seed phía server |
| Trễ tiến độ | Kiểm tra trong buổi xem lại tuần; giới hạn WIP | Cắt theo thứ tự bên dưới |
| Gemini lỗi, chậm, hết quota | Cache, retry, quota mỗi người dùng; mock trong test | Trả lỗi 503 rõ ràng; demo bằng kết quả đã cache; có video dự phòng |
| Phòng thi bị coi là giả mạo thương hiệu | Chỉ mô phỏng bố cục và thao tác; không dùng logo hay tên IDP/BC trên giao diện | Đổi màu sắc và nhãn chữ cho trung tính |
| Nội dung vi phạm trong kho cộng đồng | Báo cáo + tự ẩn; mặc định riêng tư | Chủ sở hữu hoặc nhóm gỡ nội dung |
| Render "ngủ" lúc demo | UptimeRobot ping 5 phút một lần | Mở web trước 2 phút |
| Xung đột khi hai người cùng làm | Quy tắc B5; issue DB đi trước API | Người merge sau cập nhật branch theo `main`, tạo lại migration |
| Lộ secret | `.env.example`; CI không in biến môi trường | Đổi secret ngay, báo cả nhóm |

**Thứ tự cắt giảm khi trễ** (cắt từ trên xuống, không chạm vào vòng học lõi):
1. Toàn bộ Mở rộng.
2. Tạo transcript từ audio và cắt hình khi tải đề (P3-18).
3. AI sinh bài luyện tập (P4-11).
4. AI giải thích đáp án (P4-12).
5. Chế độ Kiểm tra, Ghép thẻ, dán nhanh nhiều thẻ (P4-09, P4-10).
6. Widget Chủ đề và Cộng đồng trên dashboard.
7. Báo cáo vi phạm trong kho (giữ đăng lên, duyệt, chép).
8. Đề Full (giữ Reading và Listening riêng).
9. Nhận file DOCX trong trình đọc (giữ PDF và TXT).

---

# Phần H — Việc cần chốt

1. **Tên miền:** tên cụ thể và đuôi (`.id.vn` hay `.me`), ngày mua.
2. ~~**File đề kèm đáp án ở cuối** (Phần F): làm trong MVP hay để Nên có.~~ **Đã chốt 05/11:** làm trong MVP. Cả hai tab tải đề đều gắn nhãn trang nên tự tách được đề, đáp án, giải thích và transcript trong cùng một file.
3. **Report có mẫu bắt buộc của khoa không?**
4. **Cập nhật các tài liệu khác theo PLAN này** (issue P0-20, **đã xong**):
   - `Project_Structure.md`:
     - Danh sách module: thêm `library`, `home`.
     - `content/` không còn chứa đề JSON, vì đề giờ do người dùng tải lên.
     - Lưu file: thêm PDF đề và audio người dùng tải lên.
     - Local dùng Docker Postgres.
     - i18n.
   - `Working_rules.md`:
     - Mục 14 (nội dung đề) theo Phần F.
     - Các chỗ ghi "Thành viên 2" đổi theo phân công ở A3.
     - Tag Swagger thêm `Documents`, `Library`.
     - Mục 15 (tài liệu): cho phép thư mục `Analysis_Design/` (B6).
5. **Đổi tên PrepMaster → LinMaster** trong file proposal (nếu giảng viên cho sửa).

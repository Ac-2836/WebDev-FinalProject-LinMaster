# Database của LinMaster

> Tài liệu này giải thích **mỗi bảng dùng để làm gì** và các bảng liên kết với nhau thế nào. Muốn tra kiểu và ràng buộc của từng cột thì xem `Analysis_Design/01_Database/data-dictionary.md`, còn sơ đồ thì xem các file `erd-*.png` trong cùng thư mục.
> Nguồn sự thật là schema Prisma ở `server/prisma/schema/` (mỗi module một file). Khi tài liệu này khác với schema, tin schema rồi sửa lại tài liệu.

## Quy ước chung

- **PostgreSQL 16**, truy cập qua Prisma 7. Ở máy local, DB chạy bằng `docker compose up -d` và có hai database: `linmaster_dev` (dùng khi chạy app) và `linmaster_test` (dùng khi chạy test).
- **Khóa chính** của mọi bảng là `id` kiểu `uuid`, sinh bằng UUID v7 (`@default(uuid(7))`). UUID v7 tăng dần theo thời gian nên index vẫn gọn, và người ngoài không đoán được id.
- **Thời gian** lưu dạng `timestamptz`: một thời điểm tuyệt đối, lưu theo UTC. Giao diện đổi sang giờ của người dùng khi hiển thị.
- Bảng nào có `createdAt` thì Prisma tự ghi giá trị lúc tạo. Bảng nào có `updatedAt` thì Prisma tự cập nhật mỗi lần sửa.
- **Quyền sở hữu:** hầu hết dữ liệu gắn với một người dùng qua `ownerId` hoặc `userId`. Xóa tài khoản thì mọi dữ liệu của người đó bị xóa theo (`CASCADE`).
- Cột kiểu `Json` dùng cho dữ liệu có cấu trúc lồng nhau. Hình dạng của chúng được kiểm tra bằng schema Zod trong `shared/`, không phải bằng DB.
- **Ranh giới module:** mỗi module chỉ đọc và ghi bảng của chính nó. Cần dữ liệu của module khác thì gọi public API của module đó (Working_rules mục 7.6).

## Tổng quan: 22 bảng, 6 module

| Module | Bảng | Vai trò |
|---|---|---|
| auth | `User` | Tài khoản |
| core | `AiCache`, `AiUsage`, `StoredFile` | Hạ tầng dùng chung: cache AI, quota AI, file upload |
| vocab | `Document`, `VocabEntry`, `VocabContext`, `VocabLookup` | Đọc tài liệu, tra từ, sổ từ vựng |
| flashcard | `FlashcardSet`, `Card`, `CardProgress`, `StudySession`, `ReviewLog` | Bộ thẻ và lịch ôn SM-2 |
| exam | `Test`, `TestSection`, `Passage`, `QuestionGroup`, `Question`, `TestImport`, `Attempt`, `AttemptAnswer` | Đề thi IELTS, nạp đề, làm bài, chấm điểm |
| library | `Report` (cùng các cột public nằm trên `FlashcardSet` và `Test`) | Thư viện chia sẻ công khai |

```
User ─┬─ AiUsage, StoredFile                                  (core)
      ├─ Document ─┬─ VocabContext ─ VocabEntry ─ Card        (vocab → flashcard)
      │            └─ VocabLookup
      ├─ FlashcardSet ─ Card ─┬─ CardProgress                 (flashcard)
      │        └─ StudySession ┴─ ReviewLog
      ├─ Test ─ TestSection ─ Passage ─ QuestionGroup ─ Question   (exam)
      ├─ TestImport → StoredFile, Test
      ├─ Attempt ─ AttemptAnswer → Question
      └─ Report → FlashcardSet | Test (không có khóa ngoại)    (library)
```

---

## Module auth

### `User`: tài khoản người dùng
Mỗi dòng là một người học. Đây là bảng gốc: gần như mọi bảng khác đều trỏ về đây.

- `email` là duy nhất và được lưu chữ thường (service chuẩn hóa trước khi ghi và trước khi tìm).
- `passwordHash` chỉ chứa mật khẩu đã băm, không bao giờ lưu mật khẩu gốc.
- `displayName`: tên hiển thị.
- `locale` (`vi` hoặc `en`): ngôn ngữ giao diện.
- `targetBand`: band IELTS mục tiêu, từ 4.0 đến 9.0, bước 0.5 (Zod kiểm tra). Dashboard dùng giá trị này để so với điểm thật.

---

## Module core

### `AiCache`: cache kết quả AI
Lưu kết quả Gemini để **không phải gọi AI lại** khi cùng một đầu vào xuất hiện lần nữa. Ví dụ: hai người cùng hỏi nghĩa của "mitigate" trong cùng một câu thì lần thứ hai lấy ngay từ cache.

- Bảng này **không gắn với người dùng**. Kết quả được dùng chung cho mọi người.
- Khóa tra cứu là cặp duy nhất (`task`, `inputHash`):
  - `task` là tên tác vụ kèm phiên bản, ví dụ `explain-word.v2`. Đổi prompt thì tăng phiên bản, và cache cũ tự hết hiệu lực.
  - `inputHash` là SHA-256 của đầu vào đã chuẩn hóa. Với tác vụ PDF thì băm nội dung file.
- `output` đã qua kiểm tra bằng schema Zod của tác vụ, nên đọc ra là dùng được ngay.
- `expiresAt` để `null` nghĩa là không bao giờ hết hạn.

### `AiUsage`: nhật ký gọi AI
Mỗi lần một người dùng gọi tác vụ AI thì ghi một dòng. Bảng này dùng để **tính quota hằng ngày**: đếm số dòng có `cached = false` của người đó trong ngày. Lần trúng cache vẫn được ghi để thống kê, nhưng không trừ quota.

- `inputTokens` và `outputTokens` dùng để theo dõi chi phí.
- Index (`userId`, `createdAt`) giúp đếm quota trong ngày nhanh.

### `StoredFile`: file người dùng tải lên
Thông tin về các file trong luồng nạp đề: PDF đề, PDF đáp án, audio Listening và ảnh sơ đồ. File thật nằm trong thư mục `uploads/` (local) hoặc trên dịch vụ S3 (Backblaze B2 khi deploy). Bảng này chỉ lưu `storageKey` (đường dẫn hoặc object key, là duy nhất).

- `mimeType` được xác định từ **nội dung** file, không tin phần đuôi file.
- `sizeBytes`, `originalName`.
- `durationSec` chỉ có với file audio.
- **Tài liệu đọc của module vocab không đi qua bảng này.** Với tài liệu đọc, hệ thống chỉ giữ phần chữ đã trích, không giữ file.
- **Ràng buộc khi xóa file:**
  - File PDF (đề, đáp án, hoặc PDF gộp) mà một `TestImport` đang dùng thì **không xóa được** (`RESTRICT`).
  - Các khóa ngoại tùy chọn (audio của section, ảnh của group, audio của import) hiện là `SET NULL`: xóa file thì cột đó thành `null`.

---

## Module vocab

### `Document`: tài liệu đọc
Một bài người học dán vào, tải lên, hoặc lấy từ bài đọc trong đề thi. Người học đọc bài này rồi bôi đen để tra từ.

- `source`:
  - `paste`: dán chữ vào.
  - `file`: tải file lên. Chỉ giữ phần chữ, không giữ file.
  - `exam`: lấy từ một passage của đề. Khi đó `sourceRef` = `{ attemptId, passageId }`.
- `paragraphs`: mảng `[{ label?, text }]`, khoảng trắng đã được chuẩn hóa.
- `wordCount`: tối đa 20.000 từ mỗi tài liệu.

### `VocabEntry`: một mục trong sổ từ vựng
Một từ hoặc cụm từ người học đã lưu.

- `headword`: dạng người học bôi đen, ví dụ "mitigated". `lemma`: dạng gốc, ví dụ "mitigate".
- Các cột do AI điền: `partOfSpeech`, `ipa`, `meaningVi` (nghĩa tiếng Việt hợp với ngữ cảnh lúc lưu), `definitionEn`, `usageNote`, `collocations`, `cefr` (A1–C2), `topics`.
- `note`: ghi chú riêng của người học.
- Mỗi người chỉ có **một mục cho mỗi cặp (`lemma`, `partOfSpeech`)**. Lưu lại cùng từ đó thì thêm ngữ cảnh mới, không tạo mục trùng.
- Index GIN trên `topics` giúp lọc từ theo chủ đề nhanh.

### `VocabContext`: câu chứa từ
Câu mà từ được lưu ra từ đó. Một `VocabEntry` có nhiều ngữ cảnh, vì cùng một từ có thể gặp ở nhiều bài.

- `sentence`: nguyên câu.
- `documentId`: tài liệu chứa câu. Xóa tài liệu thì cột này thành `null` (`SET NULL`), còn câu vẫn được giữ.
- `startOffset` và `endOffset`: vị trí của từ trong tài liệu, dùng để tô sáng lại những từ đã lưu khi mở bài.
- `sourceUrl`: dành cho tiện ích trình duyệt (tính năng sau này).

### `VocabLookup`: nhật ký tra từ
Mỗi lần tra từ thì ghi một dòng, **dù có lưu từ hay không** (cột `saved`). Bảng này cung cấp dữ liệu cho lịch hoạt động trên dashboard.

- `text`: từ hoặc cụm từ được bôi đen, tối đa 6 từ.
- `sentence`: câu chứa từ đó.
- `documentId`: xóa tài liệu thì cột này thành `null`.

---

## Module flashcard

### `FlashcardSet`: bộ thẻ
Một bộ flashcard của người học.

- `title`, `description`.
- `termLang` (mặc định `en`) và `definitionLang` (mặc định `vi`).
- Các cột của **library**, chỉ được đổi qua public API của flashcard:
  - `visibility`: `private`, `public`, hoặc `hidden` (bị ẩn sau khi nhận đủ báo cáo).
  - `publishedAt`: lần cuối đăng lên thư viện.
  - `copiedFromId`: bộ gốc nếu bộ này được chép từ thư viện. Xóa bộ gốc thì bản chép vẫn còn (`SET NULL`).
  - `copyCount`: số lần người khác đã chép bộ này.
- Index (`visibility`, `publishedAt`) phục vụ trang thư viện: lọc bộ công khai, mới nhất lên trước.

### `Card`: một thẻ
Một thẻ trong bộ thẻ, gồm `term`, `definition`, `example` và `position` (thứ tự trong bộ).

- `vocabEntryId`: nếu thẻ được tạo từ sổ từ vựng. Xóa từ trong sổ thì thẻ vẫn còn (`SET NULL`).
- Khi lưu trình soạn thẻ:
  - thẻ đã có `id` thì được **cập nhật**;
  - thẻ mới thì được **thêm**;
  - thẻ bị bỏ thì bị **xóa**.

  Nhờ vậy tiến độ học của những thẻ giữ lại không bị mất.

### `CardProgress`: tiến độ SM-2 của một người trên một thẻ
Trạng thái ôn tập theo thuật toán SM-2. Mỗi cặp (`userId`, `cardId`) có đúng một dòng.

- `easiness`: hệ số dễ, mặc định 2.5, tối thiểu 1.3 (bộ lập lịch đảm bảo).
- `intervalDays`: khoảng cách đến lần ôn tiếp theo.
- `repetitions`: số lần nhớ đúng liên tiếp.
- `lapses`: số lần quên.
- `dueAt`: lần ôn tiếp theo. Index (`userId`, `dueAt`) giúp lấy nhanh danh sách "thẻ đến hạn hôm nay".
- Trạng thái New, Learning hay Mastered **không lưu thành cột riêng**, mà suy ra từ các cột trên (sơ đồ st-04).

### `StudySession`: một buổi học
Một lần học một bộ thẻ.

- `mode`: `flip`, `learn`, `test`, `match` hoặc `exercise`.
- `startedAt`, `endedAt` (`null` nghĩa là buổi học chưa kết thúc).
- `cardsStudied`, `correctCount`.

### `ReviewLog`: lịch sử chấm một thẻ
Mỗi lần người học chấm một thẻ (`again`, `hard`, `good` hoặc `easy`) thì ghi một dòng.

- `intervalBefore` và `intervalAfter`: khoảng cách ôn trước và sau lần chấm.
- `sessionId`: có thể để trống. Xóa buổi học thì cột này thành `null`, log vẫn còn.
- Dùng cho thống kê và biểu đồ tiến độ. Index (`userId`, `reviewedAt`).

---

## Module exam

Cấu trúc một đề: **`Test` → `TestSection` → `Passage` → `QuestionGroup` → `Question`**. Xóa một tầng thì các tầng con bị xóa theo (`CASCADE`).

### `Test`: một đề thi
- `certification`: khóa trong registry chứng chỉ, ví dụ `IELTS_ACADEMIC`.
- `kind`: `reading`, `listening` hoặc `full`.
- `title`.
- `source`: nguồn của đề, bắt buộc phải có trước khi đăng lên thư viện.
- Các cột của **library**, chỉ được đổi qua public API của exam:
  - `visibility`, `publishedAt`;
  - `attemptCount`: số lượt làm của người khác. Lớn hơn 0 thì service chặn xóa đề (chỉ cho gỡ khỏi kho), để không mất bài làm của người khác.

### `TestSection`: phần thi theo kỹ năng
Một phần Listening hoặc Reading của đề.

- `position`: đề full thì Listening = 1, Reading = 2.
- `durationSec`: lấy từ registry chứng chỉ.
- `audioFileId`: file audio, bắt buộc với Listening (validator lúc nạp đề kiểm tra).

### `Passage`: bài đọc hoặc part nghe
- Với Reading: `paragraphs` = `[{ label: 'A', text }]`.
- Với Listening: `paragraphs` chứa transcript của part nếu bộ file tải lên có transcript, không thì `null`. Transcript **không gửi cho thí sinh trước khi nộp bài**. `audioStartSec` cho biết part bắt đầu ở giây thứ mấy trong audio.

### `QuestionGroup`: nhóm câu hỏi
Các câu dùng chung một dạng và một đề bài, ví dụ câu 1–5 cùng dạng True/False/Not Given.

- `kind`: dạng câu hỏi, gồm `single_choice`, `multi_choice`, `tfng`, `ynng`, `matching`, `completion`, `short_answer`, `diagram_label`.
- `fromNo` và `toNo`: khoảng số câu.
- `instructions`: đề bài của nhóm.
- `sharedOptions`: các lựa chọn dùng chung, ví dụ danh sách heading hay A–G.
- `wordLimit`: giới hạn số từ, ví dụ "NO MORE THAN TWO WORDS" → 2.
- `imageFileId`: ảnh sơ đồ cho dạng `diagram_label`.

### `Question`: một câu hỏi
- `number`: số câu trong kỹ năng (1–40).
- `prompt`: nội dung câu. Câu điền từ đánh dấu chỗ trống bằng `{{blank}}`.
- `options`: lựa chọn riêng của câu này (với câu trắc nghiệm).
- `answer`: đáp án đúng. Hình dạng tùy theo dạng câu, ví dụ `{ accepted: ['library', 'the library'] }`. Có thêm `explanation` nếu file đề kèm giải thích. **Không bao giờ gửi cho thí sinh trước khi nộp bài.**

### `TestImport`: một lần nạp đề
Theo dõi quá trình biến file PDF (cùng audio, nếu có) thành một `Test` (sơ đồ st-02).

- `status`: `queued` → `parsing` → `validating` → `done` hoặc `failed`.
- `questionFileId` và `answerFileId`: bắt buộc, có thể là cùng một file. Bộ file có nhiều PDF thì server gộp thành một PDF rồi gán vào cả hai cột.
- `audioFileId`: bắt buộc với `listening` và `full`.
- `errors`: danh sách `[{ severity, section?, questionNo?, code, message }]`, hiển thị cho người nạp. `severity = 'error'` là lỗi chặn (`failed`); chỉ có `warning` thì đề vẫn được tạo.
- `testId`: đề được tạo ra, chỉ có khi `done`. Xóa đề thì cột này thành `null`, lịch sử nạp vẫn còn.

### `Attempt`: một lượt làm bài
Một lần người học làm một đề (sơ đồ st-01).

- `status`: `in_progress` hoặc `submitted`.
- `startedAt` là giờ server. `deadlineAt` = `startedAt` + tổng thời gian các section. **Thời gian do server quyết định**, không tin đồng hồ của trình duyệt.
- `state`: `{ answers, highlights, notes, flags, position }`. Mỗi lần autosave thì ghi đè, còn `updatedAt` cho biết lần autosave cuối.
- `submittedAt`, và `autoSubmitted = true` nếu bài được nộp vì hết giờ.
- Kết quả: `listeningCorrect`, `readingCorrect`, `listeningBand`, `readingBand`.
- **Mỗi người chỉ có tối đa một lượt `in_progress` cho mỗi đề.** Ràng buộc này dùng partial unique index `Attempt_one_in_progress_per_user_test`, viết tay trong migration `add_exam_tables` vì Prisma không hỗ trợ loại index này.

### `AttemptAnswer`: kết quả chấm từng câu
Được ghi khi nộp bài, mỗi câu một dòng.

- `questionNumber`, `skill`.
- `kind`: dùng cho widget "điểm yếu" trên dashboard (thống kê theo dạng câu).
- `given`: câu trả lời của người học. `null` nghĩa là bỏ trống.
- `correctAnswer`: **bản chụp** đáp án tại lúc chấm, để kết quả không đổi nếu đề bị sửa về sau.
- `isCorrect`.
- `questionId`: xóa câu hỏi thì cột này thành `null`, kết quả cũ vẫn còn.

---

## Module library

Thư viện không có bảng nội dung riêng. Bộ thẻ và đề công khai vẫn nằm trong `FlashcardSet` và `Test`, chỉ khác ở cột `visibility`. Module library chỉ đổi các cột này qua public API của flashcard và exam (sơ đồ st-03).

### `Report`: báo cáo nội dung công khai
Người dùng báo cáo một bộ thẻ hoặc một đề công khai.

- `targetType` (`flashcard_set` hoặc `test`) và `targetId`: nội dung bị báo cáo. **Không có khóa ngoại**, vì đích có thể nằm ở một trong hai bảng. Service phải tự kiểm tra rằng đích tồn tại.
- `reason`: `wrong_content`, `copyright`, `inappropriate` hoặc `other`. `detail` là phần mô tả thêm.
- `status`: `open`, `resolved` hoặc `dismissed`.
- Mỗi người chỉ được báo cáo **một lần** cho mỗi nội dung (unique trên `reporterId`, `targetType`, `targetId`).
- Khi một nội dung nhận đủ số báo cáo `open`, `visibility` của nó chuyển sang `hidden`.

---

## Migration

Các migration nằm trong `server/prisma/migrations/`, theo thứ tự:

| Migration | Thêm |
|---|---|
| `init` | Khởi tạo (chưa có bảng) |
| `add_user` | `User` |
| `add_core_tables` | `AiCache`, `AiUsage`, `StoredFile` |
| `add_vocab_flashcard_tables` | 4 bảng vocab, 5 bảng flashcard |
| `add_exam_tables` | 8 bảng exam, cùng partial unique index của `Attempt` |
| `add_library` | `Report`, cùng các cột library trên `FlashcardSet` và `Test` |
| `add_query_indexes` | 19 index cho khóa ngoại và truy vấn thường dùng (xem `Analysis_Design/01_Database/data-dictionary.md`) |

Migration theo luật **chỉ thêm, không phá** (PLAN mục B5). Lệnh thường dùng, chạy trong thư mục `server`:

```bash
npm run db:migrate      # tạo và áp migration mới ở dev
npm run db:deploy       # áp migration có sẵn (CI, production)
npx prisma studio       # xem dữ liệu trên trình duyệt
```

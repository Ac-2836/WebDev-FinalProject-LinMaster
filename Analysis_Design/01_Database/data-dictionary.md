# Từ điển dữ liệu — LinMaster

Thiết kế CSDL cho issue **P0-05**. Hệ quản trị: PostgreSQL. ORM: Prisma, mỗi module một file schema (PLAN B3).
Sơ đồ: [`erd-00-tong-quan.png`](erd-00-tong-quan.png) và các ERD theo module `erd-01` … `erd-06`.

## Quy ước chung

- **Khóa chính:** `id uuid`, sinh ở server.
- **Thời gian:** `timestamptz`, lưu theo UTC. Mọi phép tính "theo ngày" (chuỗi ngày học, giới hạn thẻ mỗi ngày) đổi sang giờ Việt Nam (UTC+7) ở tầng service.
- **Bảng thuộc đúng một module.** Chỉ module sở hữu được ghi vào bảng của mình (Project_Structure 4.1). Module khác muốn đọc hay ghi thì gọi public API của module sở hữu.
- **Khóa ngoại sang `User`:** mọi bảng có cột chủ sở hữu (`ownerId` / `userId` / `reporterId`) đều xóa theo khi xóa User (`ON DELETE CASCADE`). Đây là quan hệ *cho phép* đi ngược chiều phụ thuộc module, vì `auth` là gốc của mọi dữ liệu người dùng.
- **jsonb** chỉ dùng cho dữ liệu có cấu trúc thay đổi theo dạng câu hoặc chỉ đọc nguyên khối. Cấu trúc của jsonb được kiểm tra bằng Zod schema trong `shared/`.
- **Migration chỉ thêm, không phá** (PLAN B5).

## Module `auth`

### User — tài khoản
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| email | varchar(255) | ✓ | UNIQUE, lưu dạng chữ thường |
| passwordHash | varchar(255) | ✓ | bcrypt |
| displayName | varchar(80) | ✓ | |
| locale | Locale | ✓ | `vi` (mặc định) / `en`, ngôn ngữ giao diện |
| targetBand | decimal(2,1) |  | Mục tiêu band (4.0–9.0, bước 0.5), dùng cho dashboard |
| createdAt, updatedAt | timestamptz | ✓ | |

## Module `core`

### AiCache — cache kết quả AI
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| task | varchar(60) | ✓ | Tên và phiên bản task, ví dụ `explain-word.v1` |
| inputHash | char(64) | ✓ | SHA-256 của input đã chuẩn hóa. UNIQUE `(task, inputHash)` |
| output | jsonb | ✓ | Kết quả đã qua validate Zod |
| model | varchar(60) | ✓ | Model Gemini đã dùng |
| createdAt | timestamptz | ✓ | |
| expiresAt | timestamptz |  | null = không hết hạn |

Không gắn với người dùng: cùng một input dùng chung kết quả. Riêng task tách PDF đề có `inputHash` tính từ nội dung file, nên chỉ trúng cache khi tải lại đúng file đó.

### AiUsage — nhật ký gọi AI
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| userId | uuid | ✓ | FK → User |
| task | varchar(60) | ✓ | |
| cached | boolean | ✓ | true nếu lấy từ cache (không tính vào quota) |
| inputTokens, outputTokens | int |  | Lấy từ phản hồi Gemini |
| createdAt | timestamptz | ✓ | INDEX `(userId, createdAt)` để đếm quota theo ngày |

### StoredFile — file đã tải lên
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User |
| storageKey | varchar(255) | ✓ | UNIQUE. Đường dẫn trong `uploads/` (local) hoặc key trên R2 |
| mimeType | varchar(100) | ✓ | Đã kiểm tra bằng nội dung file, không tin phần mở rộng |
| sizeBytes | int | ✓ | |
| originalName | varchar(255) | ✓ | |
| durationSec | int |  | Chỉ với audio |
| createdAt | timestamptz | ✓ | |

Chỉ lưu file của luồng tải đề (PDF đề, PDF đáp án, audio, ảnh sơ đồ). File tài liệu đọc của `vocab` **không** lưu, chỉ lấy chữ.

## Module `vocab`

### Document — tài liệu đọc
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User |
| title | varchar(200) | ✓ | Mặc định lấy từ dòng đầu hoặc tên file |
| source | DocumentSource | ✓ | `paste` / `file` / `exam` |
| paragraphs | jsonb | ✓ | `[{ label?: string, text: string }]`, đã chuẩn hóa khoảng trắng |
| sourceRef | jsonb |  | Với `exam`: `{ attemptId, passageId }` |
| wordCount | int | ✓ | Giới hạn 20.000 từ mỗi tài liệu |
| createdAt, updatedAt | timestamptz | ✓ | |

### VocabEntry — từ trong kho từ
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User |
| headword | varchar(120) | ✓ | Dạng người dùng đã chọn, ví dụ `mitigated` |
| lemma | varchar(120) | ✓ | Dạng gốc, ví dụ `mitigate` |
| partOfSpeech | varchar(20) | ✓ | `noun`, `verb`, `phrase`… UNIQUE `(ownerId, lemma, partOfSpeech)` |
| ipa | varchar(120) |  | |
| meaningVi | text | ✓ | Nghĩa tiếng Việt đúng với ngữ cảnh lúc lưu |
| definitionEn | text |  | |
| usageNote | text |  | Cách dùng, sắc thái |
| collocations | text[] | ✓ | Có thể rỗng |
| cefr | Cefr |  | |
| topics | text[] | ✓ | Có thể rỗng. INDEX GIN để lọc theo chủ đề |
| note | text |  | Ghi chú riêng của người học |
| createdAt, updatedAt | timestamptz | ✓ | |

### VocabContext — câu gốc của từ
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| entryId | uuid | ✓ | FK → VocabEntry, `ON DELETE CASCADE` |
| documentId | uuid |  | FK → Document, `ON DELETE SET NULL` (xóa tài liệu vẫn giữ câu gốc) |
| sentence | text | ✓ | Câu chứa từ |
| startOffset, endOffset | int |  | Vị trí trong tài liệu, để tô lại từ đã lưu |
| sourceUrl | varchar(2048) |  | Tra từ qua extension (Mở rộng) |
| createdAt | timestamptz | ✓ | |

### VocabLookup — nhật ký tra từ
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User. INDEX `(ownerId, createdAt)` |
| documentId | uuid |  | FK → Document, `ON DELETE SET NULL` |
| text | varchar(120) | ✓ | Từ hoặc cụm từ được chọn (tối đa 6 từ) |
| sentence | text | ✓ | |
| saved | boolean | ✓ | Người học có lưu từ này không |
| createdAt | timestamptz | ✓ | |

## Module `flashcard`

### FlashcardSet — bộ thẻ
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User |
| title | varchar(200) | ✓ | |
| description | text |  | |
| termLang, definitionLang | varchar(10) | ✓ | Mã ngôn ngữ, mặc định `en` / `vi` |
| visibility | Visibility | ✓ | `private` (mặc định) / `public` / `hidden` (bị ẩn do báo cáo) |
| publishedAt | timestamptz |  | Lần đăng lên kho gần nhất |
| copiedFromId | uuid |  | FK → FlashcardSet, `ON DELETE SET NULL` |
| copyCount | int | ✓ | Số lượt người khác chép về |
| createdAt, updatedAt | timestamptz | ✓ | INDEX `(visibility, publishedAt)` cho trang kho |

### Card — thẻ
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| setId | uuid | ✓ | FK → FlashcardSet, `ON DELETE CASCADE` |
| position | int | ✓ | Thứ tự trong bộ |
| term, definition | text | ✓ | |
| example | text |  | |
| vocabEntryId | uuid |  | FK → VocabEntry, `ON DELETE SET NULL` |
| createdAt, updatedAt | timestamptz | ✓ | |

Khi lưu trình soạn (`PUT .../cards`): thẻ có `id` thì cập nhật, thẻ mới thì thêm, thẻ bị bỏ thì xóa. Nhờ vậy tiến độ học của các thẻ còn giữ không bị mất.

### CardProgress — tiến độ SM-2
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| userId | uuid | ✓ | FK → User |
| cardId | uuid | ✓ | FK → Card, `ON DELETE CASCADE`. UNIQUE `(userId, cardId)` |
| easiness | real | ✓ | Hệ số dễ SM-2, mặc định 2.5, tối thiểu 1.3 |
| intervalDays | int | ✓ | Khoảng ôn hiện tại |
| repetitions | int | ✓ | Số lần nhớ đúng liên tiếp |
| lapses | int | ✓ | Số lần quên |
| dueAt | timestamptz | ✓ | INDEX `(userId, dueAt)` để lấy thẻ đến hạn |
| lastReviewedAt | timestamptz |  | |

Trạng thái hiển thị (Mới / Đang học / Đã thuộc) **tính ra từ các cột này**, không lưu riêng. Xem sơ đồ state `st-04`.

### StudySession — phiên học
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| userId | uuid | ✓ | FK → User |
| setId | uuid | ✓ | FK → FlashcardSet, `ON DELETE CASCADE` |
| mode | StudyMode | ✓ | |
| startedAt | timestamptz | ✓ | |
| endedAt | timestamptz |  | null = phiên chưa kết thúc. Dùng để tính thời gian học |
| cardsStudied, correctCount | int | ✓ | |

### ReviewLog — lịch sử chấm thẻ
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| userId | uuid | ✓ | FK → User. INDEX `(userId, reviewedAt)` |
| cardId | uuid | ✓ | FK → Card, `ON DELETE CASCADE` |
| sessionId | uuid |  | FK → StudySession, `ON DELETE SET NULL` |
| rating | Rating | ✓ | |
| intervalBefore, intervalAfter | int | ✓ | |
| reviewedAt | timestamptz | ✓ | |

## Module `exam`

### Test — đề thi
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User |
| certification | varchar(40) | ✓ | Khóa trong certification registry, ví dụ `IELTS_ACADEMIC` |
| kind | TestKind | ✓ | |
| title | varchar(200) | ✓ | |
| source | varchar(300) |  | Nguồn đề (bắt buộc trước khi đăng lên kho) |
| visibility | Visibility | ✓ | |
| publishedAt | timestamptz |  | |
| attemptCount | int | ✓ | Số lượt làm bởi người khác |
| createdAt, updatedAt | timestamptz | ✓ | |

### TestSection — kỹ năng trong đề
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| testId | uuid | ✓ | FK → Test, `ON DELETE CASCADE` |
| skill | Skill | ✓ | |
| position | int | ✓ | Đề Full: Listening = 1, Reading = 2 |
| durationSec | int | ✓ | Lấy từ certification registry |
| audioFileId | uuid |  | FK → StoredFile. Bắt buộc với Listening |

### Passage — passage (Reading) hoặc part (Listening)
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| sectionId | uuid | ✓ | FK → TestSection, `ON DELETE CASCADE` |
| position | int | ✓ | |
| title | varchar(200) | ✓ | |
| paragraphs | jsonb |  | Reading: `[{ label: 'A', text }]`. Listening: null |
| audioStartSec | int |  | Listening: mốc bắt đầu part trong audio |

### QuestionGroup — nhóm câu
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| passageId | uuid | ✓ | FK → Passage, `ON DELETE CASCADE` |
| position | int | ✓ | |
| kind | QuestionKind | ✓ | Khóa trong question kind registry |
| fromNo, toNo | int | ✓ | Khoảng số câu, ví dụ 1–5 |
| instructions | text | ✓ | |
| sharedOptions | jsonb |  | Phương án dùng chung (danh sách heading, A–G…) |
| wordLimit | int |  | Completion: "NO MORE THAN TWO WORDS" → 2 |
| imageFileId | uuid |  | FK → StoredFile (Nên có: điền nhãn sơ đồ) |

### Question — câu hỏi
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| groupId | uuid | ✓ | FK → QuestionGroup, `ON DELETE CASCADE` |
| number | int | ✓ | Số câu trong kỹ năng (1–40) |
| prompt | text | ✓ | Có chỗ trống ký hiệu `{{blank}}` với completion |
| options | jsonb |  | Phương án riêng của câu (trắc nghiệm) |
| answer | jsonb | ✓ | Đáp án đúng; schema theo dạng câu, ví dụ `{ accepted: ['library', 'the library'] }`. **Không bao giờ gửi cho thí sinh trước khi nộp bài** |

### TestImport — lượt tải đề
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| ownerId | uuid | ✓ | FK → User |
| kind | TestKind | ✓ | |
| status | ImportStatus | ✓ | Xem sơ đồ state `st-02` |
| questionFileId, answerFileId | uuid | ✓ | FK → StoredFile |
| audioFileId | uuid |  | FK → StoredFile, bắt buộc với `listening` / `full` |
| errors | jsonb |  | `[{ section?, questionNo?, code, message }]` |
| testId | uuid |  | FK → Test, có khi `status = done` |
| createdAt | timestamptz | ✓ | |
| finishedAt | timestamptz |  | |

### Attempt — lượt làm bài
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| userId | uuid | ✓ | FK → User |
| testId | uuid | ✓ | FK → Test, `ON DELETE CASCADE` |
| status | AttemptStatus | ✓ | Mỗi `(userId, testId)` chỉ có tối đa một lượt `in_progress` (partial unique index) |
| startedAt | timestamptz | ✓ | Giờ server |
| deadlineAt | timestamptz | ✓ | `startedAt` + tổng thời gian các kỹ năng |
| submittedAt | timestamptz |  | |
| autoSubmitted | boolean | ✓ | true nếu nộp do hết giờ |
| state | jsonb | ✓ | `{ answers, highlights, notes, flags, position }`, ghi đè mỗi lần tự lưu |
| listeningCorrect, readingCorrect | int |  | Số câu đúng |
| listeningBand, readingBand | decimal(2,1) |  | Quy đổi theo bảng band của registry |
| updatedAt | timestamptz | ✓ | Lần tự lưu gần nhất |

### AttemptAnswer — kết quả từng câu
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| attemptId | uuid | ✓ | FK → Attempt, `ON DELETE CASCADE` |
| questionId | uuid |  | FK → Question, `ON DELETE SET NULL` |
| questionNumber | int | ✓ | |
| skill | Skill | ✓ | |
| kind | QuestionKind | ✓ | Dùng cho thống kê điểm yếu theo dạng câu |
| given | jsonb |  | null = bỏ trống |
| correctAnswer | jsonb | ✓ | Chụp lại lúc chấm |
| isCorrect | boolean | ✓ | |

## Module `library`

### Report — báo cáo vi phạm
| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| id | uuid | ✓ | PK |
| reporterId | uuid | ✓ | FK → User |
| targetType | ContentType | ✓ | |
| targetId | uuid | ✓ | Id của FlashcardSet hoặc Test (không có FK vì đa hình) |
| reason | ReportReason | ✓ | |
| detail | text |  | |
| status | ReportStatus | ✓ | |
| createdAt | timestamptz | ✓ | UNIQUE `(reporterId, targetType, targetId)`: mỗi người báo cáo một nội dung một lần |

Các cột công khai (`visibility`, `publishedAt`, `copyCount`, `attemptCount`) nằm trên bảng của `flashcard` và `exam`. `library` thay đổi chúng **qua public API** của hai module đó.

## Module `stats`

Không có bảng. Mọi số liệu tính từ bảng của các module khác qua public API:

| Widget | Nguồn |
|---|---|
| Lịch hoạt động, chuỗi ngày | `VocabLookup`, `VocabEntry`, `ReviewLog`, `Attempt.submittedAt` |
| Thẻ số liệu | `Attempt`, `VocabEntry`, `CardProgress`, `ReviewLog`, `StudySession` |
| Xu hướng band | `Attempt` (listeningBand, readingBand, submittedAt), `User.targetBand` |
| Vốn từ | `VocabEntry.createdAt`, trạng thái tính từ `CardProgress` |
| Điểm yếu | `AttemptAnswer` nhóm theo `kind` |
| Chủ đề | `VocabEntry.topics` |
| Cộng đồng | `FlashcardSet.copyCount`, `Test.attemptCount`, số nội dung `public` |

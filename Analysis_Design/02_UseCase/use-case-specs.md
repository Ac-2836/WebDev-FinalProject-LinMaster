# Đặc tả use case — LinMaster

Thuộc issue **P0-03** (vocab, flashcard, exam) và **P0-04** (auth, library, stats). Mẫu đặc tả theo PLAN B6. Đặc tả **mọi** use case có trong sơ đồ (UC01–UC51).

**Actor**

| Actor | Mô tả |
|---|---|
| Khách | Người chưa đăng nhập. Chỉ xem trang giới thiệu, đăng ký, đăng nhập, đổi ngôn ngữ |
| Người học | Người đã đăng nhập. Dùng mọi chức năng; là chủ sở hữu của tài liệu, kho từ, bộ thẻ, đề, bài làm của mình |
| Gemini AI | Hệ thống ngoài. Chỉ được gọi qua AI gateway của server |
| Đồng hồ hệ thống | Thời gian của server. Kích hoạt tự nộp bài khi hết giờ |

**Quy ước chung cho mọi use case của Người học:** tiền điều kiện luôn gồm "đã đăng nhập". Hết phiên đăng nhập thì chuyển về `/login?next=<trang hiện tại>`. Mọi thông báo hiển thị theo ngôn ngữ giao diện đang chọn.

**Lỗi AI chung** cho mọi use case gọi Gemini (UC12, 14, 27, 30, 36). Mỗi người có tối đa 50 lượt AI mỗi ngày (tính từ 0 giờ giờ Việt Nam, kết quả lấy từ cache không tính) và tối đa 20 yêu cầu tới các route AI mỗi phút (đếm cả yêu cầu được lấy từ cache).

| Mã | Khi nào |
|---|---|
| 429 `AI_QUOTA_EXCEEDED` | Hết lượt trong ngày; kèm `retryAt` là thời điểm được dùng lại. Quá 20 yêu cầu AI mỗi phút cũng trả 429 (`RESOURCE_EXHAUSTED`) |
| 502 `AI_INVALID_OUTPUT` | AI trả kết quả sai định dạng cả 3 lần gọi; hoặc service từ chối kết quả (Luyện tập AI: còn dưới một nửa số câu; tra từ: cụm không nằm trong câu) |
| 503 `AI_UNAVAILABLE` | Không gọi được AI (mạng, quá tải) sau 2 lần thử lại, hoặc chưa cấu hình khóa |
| 500 `AI_REQUEST_REJECTED` | Model từ chối chính yêu cầu (lỗi của hệ thống, không thử lại) |

---

## UC01 — Đăng ký
| | |
|---|---|
| Actor | Khách |
| Tiền điều kiện | Chưa đăng nhập |
| Luồng chính | 1. Khách mở `/register`, nhập tên hiển thị, email, mật khẩu và (tùy chọn) chọn mục tiêu band. 2. Hệ thống kiểm tra dữ liệu (email hợp lệ, mật khẩu ≥ 8 ký tự). 3. Hệ thống tạo tài khoản với ngôn ngữ giao diện đang chọn. 4. Hệ thống đăng nhập luôn và chuyển tới `/home` |
| Luồng thay thế / lỗi | 2a. Dữ liệu sai: báo lỗi ngay dưới ô nhập. 3a. Email đã tồn tại: báo "Email đã được dùng" (409). 3b. Một địa chỉ IP đăng ký quá 5 tài khoản trong một giờ: 429 |
| Hậu điều kiện | Có bản ghi `User`; người dùng ở trạng thái đã đăng nhập |

## UC02 — Đăng nhập
| | |
|---|---|
| Actor | Khách |
| Tiền điều kiện | Có tài khoản |
| Luồng chính | 1. Khách nhập email, mật khẩu. 2. Hệ thống kiểm tra, cấp JWT. 3. Chuyển tới trang `next` (nếu có) hoặc `/home`. Ngôn ngữ giao diện lấy theo hồ sơ |
| Luồng thay thế / lỗi | 2a. Sai email hoặc mật khẩu: báo "Email hoặc mật khẩu không đúng" (không cho biết sai phần nào). 2b. Thử sai quá 10 lần trong 15 phút: 429, yêu cầu thử lại sau. 2c. Quên mật khẩu: Khách bấm liên kết ở trang đăng nhập để mở `/forgot-password`, trang này chỉ hướng dẫn, chưa gửi được email đặt lại |
| Hậu điều kiện | Client giữ JWT; mọi request sau gắn token |

## UC03 — Đăng xuất
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở menu tài khoản trên navbar, bấm "Đăng xuất". 2. Client xóa phiên đăng nhập (token) đã lưu. 3. Chuyển về trang giới thiệu `/` |
| Luồng thay thế / lỗi | 2a. Token đã hết hạn từ trước: vẫn xóa phiên và chuyển trang như bình thường |
| Hậu điều kiện | Không còn phiên đăng nhập trên trình duyệt này |

## UC04 — Cập nhật hồ sơ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/profile`. 2. Sửa tên hiển thị, ngôn ngữ giao diện, mục tiêu band. 3. Bấm "Lưu", client gửi `PATCH /auth/me`. 4. Server validate bằng Zod, cập nhật `User`. 5. Hiện thông báo "Đã lưu". 6. Ở mục bảo mật, người học đổi email (`PATCH /auth/me/email`) hoặc đổi mật khẩu (`PATCH /auth/me/password`); cả hai đòi nhập mật khẩu hiện tại |
| Luồng thay thế / lỗi | 4a. Dữ liệu không hợp lệ (tên rỗng, band ngoài 4.0–9.0 hoặc không chia hết cho 0.5): 400, hiện lỗi ngay dưới ô tương ứng. 4c. Đổi email hoặc mật khẩu nhập sai mật khẩu hiện tại: 403 `WRONG_PASSWORD`; email mới đã có người dùng: 409. 4d. Quá 10 lần đổi email hoặc mật khẩu trong 15 phút: 429. 4b. Mất mạng: giữ nguyên dữ liệu trên form, cho bấm lưu lại |
| Hậu điều kiện | `User` được cập nhật. Mục tiêu band hiện thành vạch mục tiêu trên dashboard (UC50) |

## UC05 — Đổi ngôn ngữ giao diện
| | |
|---|---|
| Actor | Khách, Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người dùng bấm nút ngôn ngữ (VI / EN) trên navbar. 2. Toàn bộ giao diện đổi ngôn ngữ ngay, không tải lại trang. 3. Nếu đã đăng nhập: client gửi `PATCH /auth/me` để lưu `locale`, lần sau đăng nhập ở máy khác vẫn đúng ngôn ngữ |
| Luồng thay thế / lỗi | 1a. Khách: ngôn ngữ chỉ lưu ở trình duyệt. 3a. Lưu lên server thất bại: giao diện vẫn đổi, lần đổi sau thử lưu lại |
| Hậu điều kiện | Giao diện hiển thị theo ngôn ngữ đã chọn |

## UC10 — Tạo tài liệu đọc
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Ở `/read`, người học bấm "Tài liệu mới". 2. Chọn dán văn bản, hoặc tải file PDF / DOCX / TXT (tối đa 5 MB). 3. Client gửi `POST /vocab/documents`. 4. Server kiểm tra định dạng bằng nội dung file, trích chữ, chuẩn hóa thành các đoạn, **không lưu file gốc**. 5. Tạo `Document` (nguồn `paste` hoặc `file`). 6. Mở trình đọc `/read/[id]` (UC11) |
| Luồng thay thế / lỗi | 2a. File quá 5 MB hoặc sai định dạng: báo ngay trên form, không gửi lên (server trả 413 quá 5 MB, 415 sai định dạng). 4c. Văn bản quá 20.000 từ: 413, báo chia thành nhiều phần. 4a. PDF chỉ có ảnh scan, không trích được chữ: báo "Không đọc được chữ trong file". 4b. Văn bản rỗng sau khi trích: báo lỗi (422), không tạo tài liệu |
| Hậu điều kiện | Có `Document` mới của người học |

## UC11 — Đọc tài liệu
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Tài liệu là của mình |
| Luồng chính | 1. Người học mở `/read`, chọn một tài liệu. 2. Client gọi `GET /vocab/documents/:id`, nhận nội dung và danh sách từ đã lưu trong tài liệu. 3. Trình đọc hiện các đoạn văn, **tô màu những từ đã lưu**. 4. Bảng bên cạnh có Lọc nhanh (UC14) và danh sách từ đã lưu trong tài liệu. 5. Người học đọc, bôi chọn để tra (UC12) |
| Luồng thay thế / lỗi | 2a. Tài liệu của người khác hoặc không tồn tại: 404. 1a. Xóa tài liệu (`DELETE /vocab/documents/:id`, có hộp xác nhận): các từ đã lưu vẫn còn trong kho, chỉ mất liên kết tới tài liệu |
| Hậu điều kiện | — |

## UC12 — Tra từ theo ngữ cảnh
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Đang mở một tài liệu trong trình đọc (UC11) |
| Luồng chính | 1. Người học bôi chọn một từ hoặc cụm từ (tối đa 6 từ). 2. Trình đọc hiện nút "Giải thích" (hoặc phím tắt). 3. Client gửi từ + câu chứa từ + vị trí chọn + tiêu đề và đoạn văn chứa từ. 4. Server tra AiCache; không có thì gọi Gemini qua AI gateway (task `explain-word.v2`, đọc chủ đề của bài trước khi dịch), kiểm tra kết quả bằng schema, lưu cache. 5. Server kiểm tra cụm AI giải nghĩa: nguyên văn trong câu, chạm vùng chọn, tối đa 6 từ (sai thì hỏi lại 1 lần). Chọn cụm có nghĩa thì giải nghĩa nguyên cụm; chọn cụm vô nghĩa thì rút về cụm có nghĩa gần nhất và trả vị trí mới. 6. Server ghi `VocabLookup`, trả về: nghĩa tiếng Việt **đúng trong câu và chủ đề bài**, định nghĩa tiếng Anh, IPA, loại từ, cách dùng, collocations, CEFR, chủ đề, và cụm thật sự được giải nghĩa. 7. Trình đọc dời khung đánh dấu theo cụm đó và hiện popover giải thích |
| Luồng thay thế / lỗi | 1a. Chọn quá 6 từ: không nhận vùng chọn, hiện thông báo "Chọn tối đa 6 từ". Chọn qua hai đoạn: hiện "Chỉ chọn trong một đoạn.". 4a. Hết quota AI trong ngày: báo lỗi 429 kèm thời điểm được dùng lại. 4b. Gemini không phản hồi sau 2 lần thử lại: báo 503 "AI đang bận, thử lại sau". 4c. AI hai lần trả cụm không nằm trong câu: báo 502. 4d. `documentId` không phải của người học: 404. Các mã AI xem "Lỗi AI chung" |
| Hậu điều kiện | Có `VocabLookup`. Có thể tiếp tục UC13 |

## UC13 — Lưu từ vào kho
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Đang xem kết quả tra từ (UC12) hoặc danh sách ứng viên lọc nhanh (UC14) |
| Luồng chính | 1. Người học bấm "Lưu" (hoặc tick nhiều ứng viên rồi "Lưu các từ đã chọn"). 2. Server tìm `VocabEntry` cùng `(lemma, loại từ)` của người học. 3. Chưa có thì tạo mới; có rồi thì chỉ thêm `VocabContext` (câu gốc mới). 4. Trình đọc tô màu từ vừa lưu; popover chuyển sang "Đã lưu kèm câu này" kèm liên kết "Mở kho từ" (Lọc nhanh chỉ hiện toast "Đã lưu N từ") |
| Luồng thay thế / lỗi | 3a. Từ đã có cùng câu gốc: không thêm gì, báo "Từ này đã có trong kho" |
| Hậu điều kiện | Từ có trong kho, gắn câu gốc và tài liệu nguồn |

## UC14 — Lọc nhanh từ
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Đang mở một tài liệu |
| Luồng chính | 1. Người học mở bảng "Lọc nhanh", chọn trình độ CEFR và/hoặc chủ đề (có sẵn khoảng 15 chủ đề, hoặc gõ chủ đề khác). 2. Server gọi Gemini một lần cho cả tài liệu (task `scan-document.v1`), lấy tối đa 30 ứng viên; server bỏ ứng viên không đúng trình độ CEFR đã chọn. 3. Server **kiểm tra câu gốc phải có thật trong văn bản** và gộp từ trùng; client đánh dấu "Đã có" những từ trùng vùng đã tô trong chính tài liệu này. 4. Hiện danh sách ứng viên có checkbox. 5. Người học chọn và lưu (UC13) |
| Luồng thay thế / lỗi | 1a. Không chọn tiêu chí nào: không lọc cứng, AI ưu tiên từ trình độ B2 trở lên. 3a. Câu gốc AI bịa: loại khỏi danh sách. 3b. Không có ứng viên: hiện trạng thái trống kèm gợi ý đổi tiêu chí. 2a. Hết quota: như UC12 |
| Hậu điều kiện | Không đổi dữ liệu cho tới khi người học lưu |

## UC15 — Quản lý kho từ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/vocab`. 2. Client gọi `GET /vocab/entries` có tìm kiếm, lọc theo chủ đề / CEFR / tài liệu, phân trang. 3. Người học mở một từ để xem giải thích và các câu gốc. 4. Sửa ghi chú riêng (`PATCH`) hoặc xóa từ (`DELETE`, có hộp xác nhận). 5. Chọn nhiều từ rồi bấm "Tạo bộ thẻ" (UC23) |
| Luồng thay thế / lỗi | 2a. Kho trống: trạng thái trống kèm lối tắt "Mở trình đọc". 2b. Không có từ khớp bộ lọc: báo "Không có từ nào khớp", nút xóa bộ lọc. 4a. Xóa từ đang nằm trong một bộ thẻ: thẻ vẫn giữ nguyên, chỉ mất liên kết tới kho từ |
| Hậu điều kiện | Kho từ đã cập nhật |

## UC20 / UC21 — Tạo và sửa bộ thẻ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | UC21: là chủ sở hữu bộ thẻ |
| Luồng chính | 1. Người học mở trình soạn, nhập tiêu đề, mô tả. 2. Thêm, sửa, xóa, kéo đổi thứ tự các hàng thuật ngữ / định nghĩa / ví dụ. 3. Bấm "Lưu". 4. Server ghi lại toàn bộ danh sách thẻ trong một lần: thẻ cũ thì cập nhật, thẻ mới thì thêm, thẻ bị bỏ thì xóa |
| Luồng thay thế / lỗi | 2a. Dán nhiều dòng `thuật ngữ<Tab>định nghĩa` để thêm nhanh. 3a. Hàng trống bị bỏ qua; hàng có chữ mà thiếu thuật ngữ hoặc định nghĩa thì báo lỗi theo hàng; tiêu đề là bắt buộc. Bộ thẻ không có số thẻ tối thiểu khi lưu (nhưng cần ít nhất 1 thẻ để đăng lên kho, UC40, và 4 thẻ để Kiểm tra, Ghép thẻ, Luyện tập AI). 3b. Rời trang khi chưa lưu: hỏi xác nhận |
| Hậu điều kiện | Bộ thẻ được lưu; tiến độ học của các thẻ còn giữ không đổi |

## UC22 — Xóa bộ thẻ
| | |
|---|---|
| Actor | Người học (chủ sở hữu) |
| Tiền điều kiện | Bộ thẻ là của mình |
| Luồng chính | 1. Ở trang bộ thẻ, người học mở menu ⋮, bấm "Xóa bộ thẻ". 2. Hộp xác nhận nêu số thẻ sẽ mất. 3. Người học xác nhận, client gửi `DELETE /flashcards/sets/:id`. 4. Server xóa bộ thẻ, các thẻ, tiến độ học và phiên học của bộ đó. 5. Quay về `/flashcards` |
| Luồng thay thế / lỗi | 1a. Không phải chủ sở hữu: không có nút xóa; gọi API thì 404. 4a. Bộ thẻ đang công khai: biến khỏi kho; các bản người khác đã chép vẫn giữ nguyên |
| Hậu điều kiện | Bộ thẻ không còn |

## UC23 — Tạo bộ thẻ từ kho từ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Có từ trong kho |
| Luồng chính | 1. Ở kho từ, người học chọn nhiều từ, bấm "Tạo bộ thẻ". 2. Hộp thoại hỏi tiêu đề, client gửi `POST /flashcards/sets/from-vocab`. 3. Server tạo luôn bộ thẻ: thuật ngữ = headword, định nghĩa = nghĩa tiếng Việt, ví dụ = câu gốc đầu tiên, rồi client mở trang bộ thẻ `/flashcards/:id`. 4. Người học sửa tiếp như UC20 |
| Luồng thay thế / lỗi | 1a. Không có lựa chọn thêm vào bộ thẻ có sẵn: luôn tạo bộ mới |
| Hậu điều kiện | Thẻ liên kết `vocabEntryId` |

## UC24 — Học bằng thẻ lật
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có ít nhất 1 thẻ |
| Luồng chính | 1. Ở trang bộ thẻ, người học chọn "Thẻ lật". 2. Client mở phiên học (`POST /flashcards/sessions`, chế độ `flip`). 3. Hiện từng thẻ: phím cách hoặc bấm để lật, phím mũi tên để chuyển thẻ, có thể trộn thứ tự. 4. Hết bộ thẻ: màn "Hết bộ" với nút học lại hoặc chuyển sang Học (UC25). 5. Đóng phiên (`PATCH /flashcards/sessions/:id`) |
| Luồng thay thế / lỗi | 1a. Bộ thẻ trống: nút học bị khóa, gợi ý thêm thẻ. 5a. Bấm thoát giữa chừng: client đóng phiên, tính tới thẻ cuối đã xem; đóng tab đột ngột thì client không tự đóng phiên |
| Hậu điều kiện | Có `StudySession` chế độ `flip`. Thẻ lật **không** đổi tiến độ SM-2 |

## UC25 — Học theo lặp lại ngắt quãng
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có thẻ đến hạn hoặc thẻ mới |
| Luồng chính | 1. Người học chọn chế độ "Học". 2. Server mở phiên học, trả các thẻ đến hạn + thẻ mới (giới hạn mỗi ngày theo giờ Việt Nam). 3. Mỗi thẻ: xem mặt trước → lật (phím cách) → chấm Again / Hard / Good / Easy (phím 1–4). 4. Server cập nhật SM-2, ghi `ReviewLog`. Thẻ "Again" được hỏi lại trong phiên. 5. Hết thẻ: tổng kết phiên, đóng phiên học |
| Luồng thay thế / lỗi | 2a. Không có thẻ nào: báo "Hôm nay đã ôn xong", gợi ý chế độ Thẻ lật. 3a. Thoát giữa chừng: các thẻ đã chấm vẫn được lưu; bấm thoát thì client đóng phiên |
| Hậu điều kiện | `CardProgress` cập nhật; có `StudySession`, `ReviewLog` |

## UC26 — Kiểm tra / Ghép thẻ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có ít nhất 4 thẻ (đủ làm phương án nhiễu) |
| Luồng chính | **Kiểm tra:** 1. Người học chọn "Kiểm tra". 2. Client gọi `GET /flashcards/sets/:id/quiz`; server sinh câu hỏi từ chính bộ thẻ, **không dùng AI** (trắc nghiệm, tự gõ, đúng / sai). 3. Người học trả lời, client chấm ngay. 4. Màn kết quả: số câu đúng, danh sách câu sai. **Ghép thẻ:** 1. Người học chọn "Ghép thẻ". 2. Lưới thuật ngữ và định nghĩa xáo trộn, có đồng hồ. 3. Ghép đúng thì cặp biến mất, sai thì rung. 4. Hết lưới: hiện thời gian hoàn thành |
| Luồng thay thế / lỗi | 2a. Bộ thẻ ít hơn 4 thẻ: chế độ bị khóa, có giải thích. 3a. Tự gõ: so sánh không phân biệt hoa thường và khoảng trắng thừa |
| Hậu điều kiện | Có `StudySession` chế độ `test` hoặc `match`. Không đổi tiến độ SM-2 |

## UC27 — Luyện tập do AI sinh
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Bộ thẻ là của mình (kể cả bản đã chép), có ít nhất 4 thẻ |
| Luồng chính | 1. Ở trang bộ thẻ, người học chọn "Luyện tập AI". 2. Chọn dạng câu (trắc nghiệm, điền chỗ trống, nối) và số câu (10 hoặc 20). 3. Client gửi `POST /flashcards/sets/:id/exercises`. 4. Server tra `AiCache` theo bộ thẻ + tham số; không có thì gọi task `generate-exercise.v2` qua AI gateway với danh sách thuật ngữ và định nghĩa. 5. Server kiểm tra từng câu: đúng schema dạng câu, đáp án nằm trong phương án, chỉ dùng từ của bộ thẻ; câu không đạt thì bỏ. 6. Trả về câu hỏi kèm đáp án. 7. Người học làm bài bằng đúng component dạng câu của phòng thi, bấm "Chấm" để xem đúng / sai và đáp án. 8. Bấm "Tạo bài khác" để quay về form chọn dạng câu và số câu, hoặc về bộ thẻ (không có "làm lại cùng bài") |
| Luồng thay thế / lỗi | 4a. Hết quota AI trong ngày: 429, báo thời điểm được dùng lại. 4b. Gemini không phản hồi sau 2 lần thử lại: 503 "AI đang bận, thử lại sau". 5a. Còn dưới một nửa số câu yêu cầu (gateway đã gọi tối đa 3 lần): 502 `AI_INVALID_OUTPUT`, và cùng yêu cầu đó bị chặn 60 giây ở cả server và client. 1a. Bộ thẻ ít hơn 4 thẻ: chế độ bị khóa (server trả 422). Các mã AI xem "Lỗi AI chung" |
| Hậu điều kiện | Có `StudySession` chế độ `exercise`. Bài luyện tập không lưu DB, không đổi tiến độ SM-2 |

## UC30 — Tải đề lên
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Có các file của một đề: PDF (đề, câu hỏi, đáp án; có thể kèm giải thích, transcript) và audio với Listening (PLAN Phần F) |
| Luồng chính (tab AI nhận diện, mặc định) | 1. Người học thả các file vào một ô, thả thêm dần được. 2. Với mỗi file, server lưu file; AI (`classify-pages.v1`) gắn nhãn từng trang (đề, câu hỏi, đáp án, giải thích, transcript, không liên quan) kèm kỹ năng và khoảng số câu; audio được đọc độ dài. Giới hạn: PDF tổng cộng ≤ 20 MB, audio MP3 / M4A ≤ 60 MB, tối đa 10 file, chỉ 1 audio. 3. Màn hình hiện nhãn của từng file và **bảng Độ đầy đủ** (câu hỏi, Part / bài đọc, đáp án, audio là bắt buộc; giải thích, transcript là tùy chọn). 4. Đủ thành phần bắt buộc thì người học kiểm tra loại đề hệ thống tự nhận ra, bấm "Tạo đề"; `TestImport` = `queued`. 5. Job nền (chạy trong tiến trình server): gộp các PDF (khi có nhiều hơn một), gắn nhãn lại trang (`classify-pages.v1`, có cache); không có trang câu hỏi hoặc đáp án thì `failed` (`PAGES_MISSING`). Rồi hai task chạy song song: `parse-test.v2` trích cấu trúc đề từ các trang đề và câu hỏi, `parse-answers.v1` trích đáp án và giải thích theo số câu. Transcript Listening lấy từ file bằng `parse-transcript.v1`; nếu đề Listening không có transcript mà có audio thì `parse-audio.v2` nghe audio rồi viết transcript (không có mốc thời gian) và gắn cảnh báo `TRANSCRIPT_BY_AI`. 6. Server kiểm tra: số câu từng phần đúng theo chứng chỉ, câu nào cũng có đáp án, đáp án hợp lệ với dạng câu, audio đọc được. 7. Lưu thành đề **riêng tư**, kèm cảnh báo nếu thiếu phần tùy chọn. 8. Client (hỏi trạng thái mỗi vài giây) báo hoàn tất, đề xuất hiện trong "Đề của tôi" |
| Luồng thay thế / lỗi | 1a. **Tab Theo mẫu:** người học chọn loại đề, đặt mỗi file vào đúng ô (đề, đáp án, audio, có thể thêm transcript và giải thích); một file nằm ở nhiều ô thì hệ thống gắn nhãn trang để tách phần; thiếu ô bắt buộc hoặc sai định dạng thì báo ngay, không gửi lên; đủ thì sang bước 5. 2a. File không nhận ra là đề IELTS: đánh dấu "Không dùng", bỏ qua. 4a. Còn thiếu thành phần bắt buộc: nút "Tạo đề" bị khóa, bảng chỉ rõ phần thiếu (ví dụ "Đáp án: thiếu câu 26–40"). 6a. Có lỗi chặn: `TestImport` = `failed`, hiện danh sách lỗi theo từng câu (ví dụ "Reading câu 27: thiếu đáp án"). 7a. Thiếu giải thích hoặc transcript: vẫn tạo đề, hiện cảnh báo (transcript do AI viết: cảnh báo "do AI viết"). 5a. AI lỗi hoặc hết quota: `failed` với lỗi tương ứng, cho thử lại. 5b. Server khởi động lại hoặc ngủ giữa chừng: khi client hỏi trạng thái, lượt tải đang `queued` / `parsing` / `validating` được nhận lại và chạy lại. 4b. Bấm "Tạo đề" khi thiếu phần bắt buộc: 422 `IMPORT_INCOMPLETE`. 2b. Xóa file đang được một lượt tải dùng: 409 `IMPORT_FILE_IN_USE`. Các mã AI xem "Lỗi AI chung" |
| Hậu điều kiện | Có `Test` riêng tư (có thể kèm cảnh báo), hoặc `TestImport` thất bại kèm lỗi |

## UC31 — Quản lý đề của tôi
| | |
|---|---|
| Actor | Người học (chủ sở hữu) |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/tests`, thấy các đề của mình kèm trạng thái (chưa làm, đang làm dở, đã làm, công khai). 2. Mở menu ⋮ của một đề (chỉ có Đổi tên và Xóa). 3. "Đổi tên": nhập tiêu đề mới, gửi `PATCH /tests/:id` (API đổi được cả tiêu đề và nguồn). 4. "Xóa đề": hộp xác nhận, gửi `DELETE /tests/:id`. 5. "Đăng lên / Gỡ khỏi thư viện" nằm ở trang đề `/tests/[id]`, không nằm trong menu ⋮ (UC40) |
| Luồng thay thế / lỗi | 1a. Chưa có đề: trạng thái trống với nút "Tải đề lên" (UC30). 3a. Tiêu đề rỗng hoặc quá 200 ký tự: lỗi dưới ô. 4a. Đề đã có người khác làm (`attemptCount > 0`, kể cả khi đã gỡ khỏi kho): nút "Xóa đề" bị khóa, kèm giải thích; chủ đề chỉ được gỡ khỏi kho (UC40). Gọi API thì 409 `TEST_HAS_ATTEMPTS`. Lịch sử làm bài của người khác được giữ. 4b. Không phải chủ sở hữu: 404 |
| Hậu điều kiện | Đề được đổi tên, hoặc bị xóa cùng các bài làm của chính chủ đề |

## UC32 — Làm bài thi
| | |
|---|---|
| Actor | Người học, Đồng hồ hệ thống |
| Tiền điều kiện | Đề là của mình hoặc đang công khai trong kho |
| Luồng chính | 1. Người học mở trang đề, bấm "Bắt đầu". 2. Qua các màn trước khi thi: xác nhận thông tin, kiểm tra âm thanh (đề có audio Listening), hướng dẫn. 3. Server tạo `Attempt` (`POST /attempts`), đặt hạn nộp theo giờ server. 4. Phòng thi hiện đồng hồ đếm ngược theo giờ server. 5. Người học trả lời; có thể highlight, ghi chú, gạch bỏ phương án, đánh dấu câu, chuyển part bằng thanh dưới. 6. Bài được tự lưu 0,8 giây sau thay đổi cuối (và khi rời trang). 7. Listening: audio phát một lần, không dừng, không tua; phần Listening gồm 30 phút và 2 phút kiểm tra lại, hết audio thì phần còn lại của khung giờ là thời gian kiểm tra. Đề Full: hết giờ Listening thì lưu và tự chuyển sang Reading |
| Luồng thay thế / lỗi | 1a. Đang có bài dở của đề này: nút thành "Tiếp tục", mở thẳng phòng thi (bỏ qua các màn trước khi thi) đúng trạng thái và thời gian còn lại. 6a. Mất mạng hoặc lưu lỗi: hiện "Mất kết nối", giữ thay đổi ở trình duyệt, thử lại lùi dần (2 giây đến 30 giây) và khi có mạng. 6b. Server từ chối lưu vì đã quá hạn (409 `ATTEMPT_EXPIRED`): client tải lại bài, server nộp lười (UC33). 6c. Bài đã nộp: 409 `ATTEMPT_SUBMITTED`. 4a. Còn 10 phút và 5 phút: cảnh báo |
| Hậu điều kiện | `Attempt.state` chứa đáp án và thao tác mới nhất |

## UC33 — Nộp bài
| | |
|---|---|
| Actor | Người học, Đồng hồ hệ thống |
| Tiền điều kiện | `Attempt` đang `in_progress` |
| Luồng chính | 1. Người học bấm "Nộp bài"; hộp xác nhận hiện số câu chưa làm. 2. Người học xác nhận. 3. Server chấm từng câu theo registry dạng câu, ghi `AttemptAnswer` (chụp lại đáp án đúng), tính số câu đúng và band. 4. Chuyển tới trang kết quả |
| Luồng thay thế / lỗi | 1a. Hết giờ: client tự gọi nộp bài, `autoSubmitted = true`. 1b. Người học đã đóng trình duyệt khi hết giờ: lần mở bài tiếp theo, server thấy quá hạn thì tự nộp với đáp án đã lưu ("nộp lười"). 3a. Gọi nộp lần hai: trả lại kết quả cũ, không chấm lại |
| Hậu điều kiện | `Attempt` = `submitted`, có điểm và band |

## UC34 / UC35 — Xem kết quả và mở bài đọc trong Trình đọc
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bài đã nộp, là bài của mình |
| Luồng chính | 1. Trang kết quả hiện điểm, band từng kỹ năng, danh sách câu (đáp án của mình / đáp án đúng), lọc câu sai. 2. Người học bấm "Mở bài đọc trong Trình đọc" ở một passage. 3. Server lấy nội dung passage qua public API của exam (chỉ cho bài đã nộp), tạo `Document` nguồn `exam`. 4. Chuyển tới `/read/[id]` để tra và lưu từ (UC12, UC13) |
| Luồng thay thế / lỗi | 3a. Passage đã từng được mở: dùng lại tài liệu cũ. 1a. Người khác truy cập: 403 |
| Hậu điều kiện | Có tài liệu đọc từ bài thi |

## UC36 — Xem giải thích đáp án
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Bài đã nộp, là bài của mình |
| Luồng chính | 1. Ở trang kết quả, người học bấm "Giải thích" ở một câu. 2. Câu đã có giải thích trích từ file đề (`Question.answer.explanation`): ngăn bên hiện giải thích đó, ghi "Từ file đề". 3. Câu chưa có giải thích: client gửi `POST /attempts/:id/questions/:no/explain?skill=`. 4. Server tra `AiCache` theo câu hỏi + đáp án của người làm; không có thì gọi task `explain-answer.v1` qua AI gateway với câu hỏi, đáp án đúng, đáp án của người làm và passage (Reading) hoặc transcript (Listening). 5. Server kiểm tra câu trích làm bằng chứng có thật trong bài. 6. Ngăn bên hiện giải thích, bằng chứng được tô sáng trong bài, ghi "Do AI tạo, có thể chưa chính xác" |
| Luồng thay thế / lỗi | 1a. Bài của người khác: 403; bài chưa nộp: 409 `ATTEMPT_NOT_SUBMITTED`; không có câu số đó: 404. 3a. Listening không có transcript: không gọi AI, trả 422 `EXPLAIN_NO_TEXT`. 4a. Hết quota AI: 429. 4b. Gemini lỗi: 503, cho thử lại. Các mã AI xem "Lỗi AI chung". 5a. Câu trích không có trong bài: bỏ phần bằng chứng, vẫn hiện giải thích |
| Hậu điều kiện | Người học hiểu vì sao đáp án đúng. AI **không** đổi điểm hay đáp án |

## UC40 — Đăng lên / gỡ khỏi kho
| | |
|---|---|
| Actor | Người học (chủ sở hữu) |
| Tiền điều kiện | Là chủ sở hữu bộ thẻ hoặc đề |
| Luồng chính | 1. Người học bấm "Đăng lên kho". 2. Đề chưa có nguồn thì hỏi nguồn trước. 3. Client gọi `POST .../publish` (không có bước xác nhận quy định). 4. `visibility` = `public`, ghi `publishedAt` = lúc đăng (gỡ rồi đăng lại thì lấy giờ mới) |
| Luồng thay thế / lỗi | 2a. Đề chưa có nguồn: yêu cầu nhập nguồn trước. 2b. Bộ thẻ không có thẻ nào: 422 `SET_EMPTY`. 1a. Nội dung đang bị ẩn do báo cáo (`hidden`): đăng lại bị 409 `CONTENT_HIDDEN`; chủ bấm "Gỡ xuống" (`hidden` thành `private`, các báo cáo đang mở chuyển `resolved`) thì sau đó đăng lại được. 1b. Gỡ khỏi kho: `visibility` = `private`; các bản người khác đã chép vẫn giữ nguyên |
| Hậu điều kiện | Nội dung xuất hiện (hoặc biến mất) trong kho |

## UC41 — Duyệt và tìm kiếm kho
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/library`, chọn tab Bộ thẻ hoặc Đề thi. 2. Nhập từ khóa, lọc theo kỹ năng (với đề), sắp xếp mới nhất hoặc phổ biến nhất. 3. Client gọi `GET /library?type=&q=&skill=&sort=&page=&pageSize=`, có phân trang. 4. Hiện danh sách card: tiêu đề, người đăng, số thẻ hoặc số câu, lượt chép / lượt làm. 5. Bấm một card để xem trước (UC42) |
| Luồng thay thế / lỗi | 3a. Không có kết quả: báo "Không tìm thấy", gợi ý bỏ bớt bộ lọc. 3b. Nội dung riêng tư hoặc đang bị ẩn: không bao giờ xuất hiện |
| Hậu điều kiện | — |

## UC42 — Xem trước nội dung
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Nội dung đang công khai |
| Luồng chính | 1. Người học mở trang xem trước từ kho. 2. Bộ thẻ: hiện tiêu đề, mô tả, người đăng, **toàn bộ thẻ**, nút "Chép về thư viện của tôi" (UC43). 3. Đề: hiện tiêu đề, kỹ năng, số câu, thời gian, các dạng câu, người đăng, số lượt làm, nút "Làm bài" (UC44); **không** lộ câu hỏi chi tiết hay đáp án. 4. Có nút "Báo cáo" (UC45) |
| Luồng thay thế / lỗi | 1a. Nội dung đã bị gỡ, bị ẩn hoặc riêng tư: 404. 2a. Người xem là chủ sở hữu: bộ thẻ hiện nút "Mở bộ thẻ của tôi" thay cho nút chép; đề chỉ ẩn nút "Báo cáo" (đăng và gỡ nằm ở trang của chủ, UC40) |
| Hậu điều kiện | — |

## UC43 — Chép bộ thẻ về thư viện
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ đang `public`, không phải của mình |
| Luồng chính | 1. Từ trang xem trước (UC42), người học bấm "Chép về thư viện của tôi". 2. Server chép sâu bộ thẻ và các thẻ, ghi `copiedFromId`, tăng `copyCount` của bản gốc, trả 201 `{setId}`. 3. Trang xem trước hiện "Đã chép" kèm liên kết mở bộ thẻ mới `/flashcards/:id` |
| Luồng thay thế / lỗi | 1a. Đã có bản chép (gọi lại hoặc bấm đúp): server trả lại bản cũ với 200, không tạo bộ mới và không tăng `copyCount`; nút thành "Đã chép · Mở bộ thẻ". Xóa bản chép rồi chép lại thì tạo bản mới. 1b. Bộ của chính mình: 409 `OWN_CONTENT` |
| Hậu điều kiện | Người học có bản riêng, sửa thoải mái mà không ảnh hưởng bản gốc |

## UC44 — Làm đề từ kho
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Đề đang công khai |
| Luồng chính | 1. Ở trang xem trước đề, người học bấm "Làm bài". 2. Client gọi `POST /attempts` với đề công khai, **không cần chép đề**. 3. Đi tiếp như UC32 (các màn trước khi thi, phòng thi), UC33 (nộp bài), UC34 (kết quả). 4. `attemptCount` của đề tăng (chỉ tính lượt của người khác chủ đề) |
| Luồng thay thế / lỗi | 2a. Đang có bài dở của đề này: nút thành "Tiếp tục". 2b. Đề vừa bị gỡ hoặc bị ẩn: 404, bài đã nộp trước đó vẫn xem được kết quả |
| Hậu điều kiện | Có `Attempt` của người học trên đề công khai |

## UC45 — Báo cáo vi phạm
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Nội dung đang công khai, không phải của mình |
| Luồng chính | 1. Người học bấm "Báo cáo", chọn lý do (sai nội dung, bản quyền, không phù hợp, khác), thêm mô tả. 2. Server ghi `Report`. 3. Nếu nội dung có từ 3 báo cáo đang mở: chuyển `visibility` = `hidden`, ẩn khỏi kho |
| Luồng thay thế / lỗi | 2a. Đã báo cáo nội dung này rồi: 409 `ALREADY_REPORTED`, báo "Bạn đã báo cáo nội dung này". 2b. Nội dung của chính mình: 409 `OWN_CONTENT`; nội dung không còn công khai: 404 |
| Hậu điều kiện | Có `Report`; nội dung có thể bị ẩn |

## UC50 — Xem dashboard cá nhân
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/dashboard`. 2. Client gọi các API thống kê song song. 3. Hiện các widget: lịch hoạt động 52 tuần và chuỗi ngày học, thẻ số liệu, xu hướng band (kèm vạch mục tiêu), vốn từ theo tuần, điểm yếu theo dạng câu kèm gợi ý, chủ đề học nhiều, đóng góp cộng đồng |
| Luồng thay thế / lỗi | 3a. Chưa có dữ liệu cho một widget: trạng thái trống kèm lối tắt bắt đầu (ví dụ "Làm bài thi đầu tiên"). 2a. Một API lỗi: chỉ widget đó báo lỗi, các widget khác vẫn hiện |
| Hậu điều kiện | — |

## UC51 — Xem trang chủ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Sau khi đăng nhập, người học vào `/home`. 2. Trang ghép các widget từ home widget registry: tiếp tục bài thi đang làm, số thẻ đến hạn hôm nay, tài liệu đọc gần đây, chuỗi ngày học. 3. Lối tắt: Đọc tài liệu mới, Tải đề, Vào kho. 4. Bấm một widget để đi tới đúng chỗ (phòng thi, phiên học, trình đọc) |
| Luồng thay thế / lỗi | 2a. Tài khoản mới: mỗi widget có trạng thái trống kèm lối tắt bắt đầu. 2b. Một widget lỗi: chỉ widget đó hiện lỗi và nút thử lại |
| Hậu điều kiện | — |

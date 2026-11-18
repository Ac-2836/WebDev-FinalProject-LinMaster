# Đặc tả use case — LinMaster

Thuộc issue **P0-03** (vocab, flashcard, exam) và **P0-04** (auth, library, stats). Mẫu đặc tả theo PLAN B6. Đặc tả **mọi** use case có trong sơ đồ (UC01–UC51); use case Nên có ghi rõ "(Nên có)".

**Actor**

| Actor | Mô tả |
|---|---|
| Khách | Người chưa đăng nhập. Chỉ xem trang giới thiệu, đăng ký, đăng nhập, đổi ngôn ngữ |
| Người học | Người đã đăng nhập. Dùng mọi chức năng; là chủ sở hữu của tài liệu, kho từ, bộ thẻ, đề, bài làm của mình |
| Gemini AI | Hệ thống ngoài. Chỉ được gọi qua AI gateway của server |
| Đồng hồ hệ thống | Thời gian của server. Kích hoạt tự nộp bài khi hết giờ |

**Quy ước chung cho mọi use case của Người học:** tiền điều kiện luôn gồm "đã đăng nhập". Hết phiên đăng nhập thì chuyển về `/login?next=<trang hiện tại>`. Mọi thông báo hiển thị theo ngôn ngữ giao diện đang chọn.

---

## UC01 — Đăng ký
| | |
|---|---|
| Actor | Khách |
| Tiền điều kiện | Chưa đăng nhập |
| Luồng chính | 1. Khách mở `/register`, nhập tên hiển thị, email, mật khẩu, nhập lại mật khẩu. 2. Hệ thống kiểm tra dữ liệu (email hợp lệ, mật khẩu ≥ 8 ký tự, hai mật khẩu khớp). 3. Hệ thống tạo tài khoản với ngôn ngữ giao diện đang chọn. 4. Hệ thống đăng nhập luôn và chuyển tới `/home` |
| Luồng thay thế / lỗi | 2a. Dữ liệu sai: báo lỗi ngay dưới ô nhập. 3a. Email đã tồn tại: báo "Email đã được dùng" |
| Hậu điều kiện | Có bản ghi `User`; người dùng ở trạng thái đã đăng nhập |

## UC02 — Đăng nhập
| | |
|---|---|
| Actor | Khách |
| Tiền điều kiện | Có tài khoản |
| Luồng chính | 1. Khách nhập email, mật khẩu. 2. Hệ thống kiểm tra, cấp JWT. 3. Chuyển tới trang `next` (nếu có) hoặc `/home`. Ngôn ngữ giao diện lấy theo hồ sơ |
| Luồng thay thế / lỗi | 2a. Sai email hoặc mật khẩu: báo "Email hoặc mật khẩu không đúng" (không cho biết sai phần nào). 2b. Thử sai quá nhiều lần: 429, yêu cầu thử lại sau |
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
| Luồng chính | 1. Người học mở `/profile`. 2. Sửa tên hiển thị, ngôn ngữ giao diện, mục tiêu band. 3. Bấm "Lưu", client gửi `PATCH /auth/me`. 4. Server validate bằng Zod, cập nhật `User`. 5. Hiện thông báo "Đã lưu" |
| Luồng thay thế / lỗi | 4a. Dữ liệu không hợp lệ (tên rỗng, band ngoài 1.0–9.0 hoặc không chia hết cho 0.5): 400, hiện lỗi ngay dưới ô tương ứng. 4b. Mất mạng: giữ nguyên dữ liệu trên form, cho bấm lưu lại |
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
| Luồng thay thế / lỗi | 2a. File quá 5 MB hoặc sai định dạng: báo ngay trên form, không gửi lên. 4a. PDF chỉ có ảnh scan, không trích được chữ: báo "Không đọc được chữ trong file". 4b. Văn bản rỗng sau khi trích: báo lỗi, không tạo tài liệu |
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
| Luồng thay thế / lỗi | 1a. Chọn quá 6 từ: nút Giải thích bị khóa, có gợi ý. 4a. Hết quota AI trong ngày: báo lỗi 429 kèm thời điểm được dùng lại. 4b. Gemini không phản hồi sau 2 lần thử lại: báo 503 "AI đang bận, thử lại sau". 4c. AI hai lần trả cụm không nằm trong câu: báo 502 |
| Hậu điều kiện | Có `VocabLookup`. Có thể tiếp tục UC13 |

## UC13 — Lưu từ vào kho
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Đang xem kết quả tra từ (UC12) hoặc danh sách ứng viên lọc nhanh (UC14) |
| Luồng chính | 1. Người học bấm "Lưu" (hoặc tick nhiều ứng viên rồi "Lưu các từ đã chọn"). 2. Server tìm `VocabEntry` cùng `(lemma, loại từ)` của người học. 3. Chưa có thì tạo mới; có rồi thì chỉ thêm `VocabContext` (câu gốc mới). 4. Trình đọc tô màu từ vừa lưu; toast có nút "Tạo bộ thẻ" |
| Luồng thay thế / lỗi | 3a. Từ đã có cùng câu gốc: không thêm gì, báo "Từ này đã có trong kho" |
| Hậu điều kiện | Từ có trong kho, gắn câu gốc và tài liệu nguồn |

## UC14 — Lọc nhanh từ
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Đang mở một tài liệu |
| Luồng chính | 1. Người học mở bảng "Lọc nhanh", chọn trình độ CEFR và/hoặc chủ đề (có sẵn khoảng 15 chủ đề, hoặc gõ chủ đề khác). 2. Server chia tài liệu thành đoạn, gọi Gemini cho từng đoạn. 3. Server **kiểm tra câu gốc phải có thật trong văn bản**, gộp từ trùng, đánh dấu từ "Đã có" trong kho. 4. Hiện danh sách ứng viên có checkbox. 5. Người học chọn và lưu (UC13) |
| Luồng thay thế / lỗi | 1a. Không chọn tiêu chí nào: lọc theo trình độ từ B2 trở lên. 3a. Câu gốc AI bịa: loại khỏi danh sách. 3b. Không có ứng viên: hiện trạng thái trống kèm gợi ý đổi tiêu chí. 2a. Hết quota: như UC12 |
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
| Luồng thay thế / lỗi | 2a. (Nên có) Dán nhiều dòng `thuật ngữ<Tab>định nghĩa` để thêm nhanh. 3a. Bộ thẻ cần ít nhất 2 thẻ có đủ thuật ngữ và định nghĩa, nếu không thì báo lỗi theo hàng. 3b. Rời trang khi chưa lưu: hỏi xác nhận |
| Hậu điều kiện | Bộ thẻ được lưu; tiến độ học của các thẻ còn giữ không đổi |

## UC22 — Xóa bộ thẻ
| | |
|---|---|
| Actor | Người học (chủ sở hữu) |
| Tiền điều kiện | Bộ thẻ là của mình |
| Luồng chính | 1. Ở trang bộ thẻ, người học mở menu ⋮, bấm "Xóa bộ thẻ". 2. Hộp xác nhận nêu số thẻ sẽ mất. 3. Người học xác nhận, client gửi `DELETE /flashcards/sets/:id`. 4. Server xóa bộ thẻ, các thẻ, tiến độ học và phiên học của bộ đó. 5. Quay về `/flashcards` |
| Luồng thay thế / lỗi | 1a. Không phải chủ sở hữu: không có nút xóa; gọi API thì 403. 4a. Bộ thẻ đang công khai: biến khỏi kho; các bản người khác đã chép vẫn giữ nguyên |
| Hậu điều kiện | Bộ thẻ không còn |

## UC23 — Tạo bộ thẻ từ kho từ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Có từ trong kho |
| Luồng chính | 1. Ở kho từ, người học chọn nhiều từ, bấm "Tạo bộ thẻ" (hoặc bấm từ toast sau khi lưu từ). 2. Trình soạn mở với các thẻ điền sẵn: thuật ngữ = headword, định nghĩa = nghĩa tiếng Việt, ví dụ = câu gốc. 3. Tiếp tục như UC20 |
| Luồng thay thế / lỗi | 1a. Chọn vào bộ thẻ có sẵn thay vì bộ mới: thêm thẻ vào cuối bộ đó (chỉ bộ của mình) |
| Hậu điều kiện | Thẻ liên kết `vocabEntryId` |

## UC24 — Học bằng thẻ lật
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có ít nhất 1 thẻ |
| Luồng chính | 1. Ở trang bộ thẻ, người học chọn "Thẻ lật". 2. Client mở phiên học (`POST /flashcards/sessions`, chế độ `flip`). 3. Hiện từng thẻ: phím cách hoặc bấm để lật, phím mũi tên để chuyển thẻ, có thể trộn thứ tự. 4. Hết bộ thẻ: màn "Hết bộ" với nút học lại hoặc chuyển sang Học (UC25). 5. Đóng phiên (`PATCH /flashcards/sessions/:id`) |
| Luồng thay thế / lỗi | 1a. Bộ thẻ trống: nút học bị khóa, gợi ý thêm thẻ. 5a. Rời trang giữa chừng: phiên được đóng ở lần gọi kế tiếp, tính tới thẻ cuối đã xem |
| Hậu điều kiện | Có `StudySession` chế độ `flip`. Thẻ lật **không** đổi tiến độ SM-2 |

## UC25 — Học theo lặp lại ngắt quãng
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có thẻ đến hạn hoặc thẻ mới |
| Luồng chính | 1. Người học chọn chế độ "Học". 2. Server mở phiên học, trả các thẻ đến hạn + thẻ mới (giới hạn mỗi ngày theo giờ Việt Nam). 3. Mỗi thẻ: xem mặt trước → lật (phím cách) → chấm Again / Hard / Good / Easy (phím 1–4). 4. Server cập nhật SM-2, ghi `ReviewLog`. Thẻ "Again" được hỏi lại trong phiên. 5. Hết thẻ: tổng kết phiên, đóng phiên học |
| Luồng thay thế / lỗi | 2a. Không có thẻ nào: báo "Hôm nay đã ôn xong", gợi ý chế độ Thẻ lật. 3a. Thoát giữa chừng: các thẻ đã chấm vẫn được lưu; phiên đóng khi rời trang |
| Hậu điều kiện | `CardProgress` cập nhật; có `StudySession`, `ReviewLog` |

## UC26 — Kiểm tra / Ghép thẻ (Nên có)
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có ít nhất 4 thẻ (đủ làm phương án nhiễu) |
| Luồng chính | **Kiểm tra:** 1. Người học chọn "Kiểm tra". 2. Client gọi `GET /flashcards/sets/:id/quiz`; server sinh câu hỏi từ chính bộ thẻ, **không dùng AI** (trắc nghiệm, tự gõ, đúng / sai). 3. Người học trả lời, client chấm ngay. 4. Màn kết quả: số câu đúng, danh sách câu sai. **Ghép thẻ:** 1. Người học chọn "Ghép thẻ". 2. Lưới thuật ngữ và định nghĩa xáo trộn, có đồng hồ. 3. Ghép đúng thì cặp biến mất, sai thì rung. 4. Hết lưới: hiện thời gian hoàn thành |
| Luồng thay thế / lỗi | 2a. Bộ thẻ ít hơn 4 thẻ: chế độ bị khóa, có giải thích. 3a. Tự gõ: so sánh không phân biệt hoa thường và khoảng trắng thừa |
| Hậu điều kiện | Có `StudySession` chế độ `test` hoặc `match`. Không đổi tiến độ SM-2 |

## UC27 — Luyện tập do AI sinh (Nên có)
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Bộ thẻ là của mình (kể cả bản đã chép), có ít nhất 4 thẻ |
| Luồng chính | 1. Ở trang bộ thẻ, người học chọn "Luyện tập AI". 2. Chọn dạng câu (trắc nghiệm, điền chỗ trống, nối) và số câu (10 hoặc 20). 3. Client gửi `POST /flashcards/sets/:id/exercises`. 4. Server tra `AiCache` theo bộ thẻ + tham số; không có thì gọi task `generate-exercise.v2` qua AI gateway với danh sách thuật ngữ và định nghĩa. 5. Server kiểm tra từng câu: đúng schema dạng câu, đáp án nằm trong phương án, chỉ dùng từ của bộ thẻ; câu không đạt thì bỏ. 6. Trả về câu hỏi kèm đáp án. 7. Người học làm bài bằng đúng component dạng câu của phòng thi, bấm "Chấm" để xem đúng / sai và đáp án. 8. Có thể làm lại hoặc tạo bài khác |
| Luồng thay thế / lỗi | 4a. Hết quota AI trong ngày: 429, báo thời điểm được dùng lại. 4b. Gemini lỗi sau 2 lần thử lại: 503 "AI đang bận, thử lại sau". 5a. Còn dưới một nửa số câu yêu cầu: báo lỗi, cho thử lại. 1a. Bộ thẻ ít hơn 4 thẻ: chế độ bị khóa |
| Hậu điều kiện | Có `StudySession` chế độ `exercise`. Bài luyện tập không lưu DB, không đổi tiến độ SM-2 |

## UC30 — Tải đề lên
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Có các file của một đề: PDF (đề, câu hỏi, đáp án; có thể kèm giải thích, transcript) và audio với Listening (PLAN Phần F) |
| Luồng chính (tab AI nhận diện, mặc định) | 1. Người học thả các file vào một ô, thả thêm dần được. 2. Với mỗi file, server lưu file; AI gắn nhãn từng trang (đề, câu hỏi, đáp án, giải thích, transcript, không liên quan) kèm kỹ năng và khoảng số câu; audio được đọc độ dài. 3. Màn hình hiện nhãn của từng file và **bảng Độ đầy đủ** (câu hỏi, Part / bài đọc, đáp án, audio là bắt buộc; giải thích, transcript là tùy chọn). 4. Đủ thành phần bắt buộc thì người học kiểm tra loại đề hệ thống tự nhận ra, bấm "Tạo đề"; `TestImport` = `queued`. 5. Job nền: AI trích cấu trúc đề từ các trang đề và câu hỏi; trích đáp án và giải thích theo số câu từ các trang đáp án; lấy transcript theo Part. 6. Server kiểm tra: số câu từng phần đúng theo chứng chỉ, câu nào cũng có đáp án, đáp án hợp lệ với dạng câu, audio đọc được. 7. Lưu thành đề **riêng tư**, kèm cảnh báo nếu thiếu phần tùy chọn. 8. Client (hỏi trạng thái mỗi vài giây) báo hoàn tất, đề xuất hiện trong "Đề của tôi" |
| Luồng thay thế / lỗi | 1a. **Tab Theo mẫu:** người học chọn loại đề, đặt mỗi file vào đúng ô (đề, đáp án, audio, có thể thêm transcript và giải thích); một file nằm ở nhiều ô thì hệ thống gắn nhãn trang để tách phần; thiếu ô bắt buộc hoặc sai định dạng thì báo ngay, không gửi lên; đủ thì sang bước 5. 2a. File không nhận ra là đề IELTS: đánh dấu "Không dùng", bỏ qua. 4a. Còn thiếu thành phần bắt buộc: nút "Tạo đề" bị khóa, bảng chỉ rõ phần thiếu (ví dụ "Đáp án: thiếu câu 26–40"). 6a. Có lỗi chặn: `TestImport` = `failed`, hiện danh sách lỗi theo từng câu (ví dụ "Reading câu 27: thiếu đáp án"). 7a. Thiếu giải thích hoặc transcript: vẫn tạo đề, hiện cảnh báo. 5a. AI lỗi hoặc hết quota: `failed` với lỗi tương ứng, cho thử lại |
| Hậu điều kiện | Có `Test` riêng tư (có thể kèm cảnh báo), hoặc `TestImport` thất bại kèm lỗi |

## UC31 — Quản lý đề của tôi
| | |
|---|---|
| Actor | Người học (chủ sở hữu) |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/tests`, thấy các đề của mình kèm trạng thái (chưa làm, đang làm dở, đã làm, công khai). 2. Mở menu ⋮ của một đề. 3. "Đổi tên": nhập tiêu đề mới, gửi `PATCH /tests/:id`. 4. "Xóa đề": hộp xác nhận, gửi `DELETE /tests/:id`. 5. "Đăng lên / Gỡ khỏi thư viện": chuyển sang UC40 |
| Luồng thay thế / lỗi | 1a. Chưa có đề: trạng thái trống với nút "Tải đề lên" (UC30). 3a. Tiêu đề rỗng hoặc quá 200 ký tự: lỗi dưới ô. 4a. Đề đã có người khác làm (`attemptCount > 0`, kể cả khi đã gỡ khỏi kho): nút "Xóa đề" bị khóa, kèm giải thích; chủ đề chỉ được gỡ khỏi kho (UC40). Gọi API thì 409 `TEST_HAS_ATTEMPTS`. Lịch sử làm bài của người khác được giữ. 4b. Không phải chủ sở hữu: 403 |
| Hậu điều kiện | Đề được đổi tên, hoặc bị xóa cùng các bài làm của chính chủ đề |

## UC32 — Làm bài thi
| | |
|---|---|
| Actor | Người học, Đồng hồ hệ thống |
| Tiền điều kiện | Đề là của mình hoặc đang công khai trong kho |
| Luồng chính | 1. Người học mở trang đề, bấm "Bắt đầu". 2. Qua các màn trước khi thi: xác nhận thông tin, hướng dẫn, kiểm tra âm thanh (Listening). 3. Server tạo `Attempt`, đặt hạn nộp theo giờ server. 4. Phòng thi hiện đồng hồ đếm ngược theo giờ server. 5. Người học trả lời; có thể highlight, ghi chú, gạch bỏ phương án, đánh dấu câu, chuyển part bằng thanh dưới. 6. Bài được tự lưu sau mỗi thay đổi (gom lại vài giây một lần). 7. Listening: audio phát một lần, không dừng, không tua; hết audio có 2 phút kiểm tra lại. Đề Full: xong Listening tự chuyển sang Reading |
| Luồng thay thế / lỗi | 1a. Đang có bài dở của đề này: nút thành "Tiếp tục", mở lại đúng trạng thái và thời gian còn lại. 6a. Mất mạng: hiện "Mất kết nối", giữ thay đổi ở trình duyệt, tự lưu lại khi có mạng. 6b. Server từ chối lưu vì đã quá hạn: chuyển sang UC33 (tự nộp). 4a. Còn 10 phút và 5 phút: cảnh báo |
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
| Actor | Người học, Gemini AI (Nên có) |
| Tiền điều kiện | Bài đã nộp, là bài của mình |
| Luồng chính | 1. Ở trang kết quả, người học bấm "Giải thích" ở một câu. 2. Câu đã có giải thích trích từ file đề (`Question.answer.explanation`): ngăn bên hiện giải thích đó, ghi "Từ file đề". 3. *(Nên có)* Câu chưa có giải thích: client gửi `POST /attempts/:id/questions/:no/explain`. 4. Server tra `AiCache` theo câu hỏi + đáp án của người làm; không có thì gọi task `explain-answer.v1` qua AI gateway với câu hỏi, đáp án đúng, đáp án của người làm và passage (Reading) hoặc transcript (Listening). 5. Server kiểm tra câu trích làm bằng chứng có thật trong bài. 6. Ngăn bên hiện giải thích, bằng chứng được tô sáng trong bài, ghi "Do AI tạo, có thể chưa chính xác" |
| Luồng thay thế / lỗi | 1a. Bài chưa nộp hoặc của người khác: 403. 3a. Listening không có transcript: AI chỉ giải thích theo câu hỏi và đáp án, không có bằng chứng. 4a. Hết quota AI: 429. 4b. Gemini lỗi: 503, cho thử lại. 5a. Câu trích không có trong bài: bỏ phần bằng chứng, vẫn hiện giải thích |
| Hậu điều kiện | Người học hiểu vì sao đáp án đúng. AI **không** đổi điểm hay đáp án |

## UC40 — Đăng lên / gỡ khỏi kho
| | |
|---|---|
| Actor | Người học (chủ sở hữu) |
| Tiền điều kiện | Là chủ sở hữu bộ thẻ hoặc đề |
| Luồng chính | 1. Người học bấm "Đăng lên kho". 2. Hệ thống nhắc quy định (nội dung phải có quyền chia sẻ; đề phải ghi nguồn). 3. Người học xác nhận. 4. `visibility` = `public`, ghi `publishedAt` |
| Luồng thay thế / lỗi | 2a. Đề chưa có nguồn: yêu cầu nhập nguồn trước. 1a. Nội dung đang bị ẩn do báo cáo (`hidden`): chỉ được gỡ hẳn, không được đăng lại cho tới khi sửa. 1b. Gỡ khỏi kho: `visibility` = `private`; các bản người khác đã chép vẫn giữ nguyên |
| Hậu điều kiện | Nội dung xuất hiện (hoặc biến mất) trong kho |

## UC41 — Duyệt và tìm kiếm kho
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | — |
| Luồng chính | 1. Người học mở `/library`, chọn tab Bộ thẻ hoặc Đề thi. 2. Nhập từ khóa, lọc theo chủ đề / kỹ năng, sắp xếp mới nhất hoặc phổ biến nhất. 3. Client gọi `GET /library?type=&q=&topic=&skill=&sort=`, có phân trang. 4. Hiện danh sách card: tiêu đề, người đăng, số thẻ hoặc số câu, lượt chép / lượt làm. 5. Bấm một card để xem trước (UC42) |
| Luồng thay thế / lỗi | 3a. Không có kết quả: báo "Không tìm thấy", gợi ý bỏ bớt bộ lọc. 3b. Nội dung riêng tư hoặc đang bị ẩn: không bao giờ xuất hiện |
| Hậu điều kiện | — |

## UC42 — Xem trước nội dung
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Nội dung đang công khai |
| Luồng chính | 1. Người học mở trang xem trước từ kho. 2. Bộ thẻ: hiện tiêu đề, mô tả, người đăng, **toàn bộ thẻ**, nút "Chép về thư viện" (UC43). 3. Đề: hiện tiêu đề, kỹ năng, số câu, thời gian, các dạng câu, người đăng, số lượt làm, nút "Làm bài" (UC44); **không** lộ câu hỏi chi tiết hay đáp án. 4. Có nút "Báo cáo" (UC45) |
| Luồng thay thế / lỗi | 1a. Nội dung đã bị gỡ, bị ẩn hoặc riêng tư: 404. 2a. Người xem là chủ sở hữu: thay nút chép bằng nút "Gỡ khỏi kho" |
| Hậu điều kiện | — |

## UC43 — Chép bộ thẻ về thư viện
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ đang `public`, không phải của mình |
| Luồng chính | 1. Từ trang xem trước (UC42), người học bấm "Lưu về thư viện". 2. Server chép sâu bộ thẻ và các thẻ, ghi `copiedFromId`, tăng `copyCount` của bản gốc. 3. Chuyển tới bộ thẻ mới của người học |
| Luồng thay thế / lỗi | 1a. Đã chép trước đó: hỏi "Mở bản đã chép" hay "Chép thêm bản mới" |
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
| Luồng thay thế / lỗi | 2a. Đã báo cáo nội dung này rồi: báo "Bạn đã báo cáo nội dung này" |
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

# Đặc tả use case — LinMaster

Thuộc issue **P0-03** (vocab, flashcard, exam) và **P0-04** (auth, library, stats). Mẫu đặc tả theo PLAN B6. Chỉ đặc tả các use case chính của vòng học; các thao tác CRUD đơn giản (UC03, UC15, UC22, UC31…) không đặc tả riêng.

**Actor**

| Actor | Mô tả |
|---|---|
| Khách | Người chưa đăng nhập. Chỉ xem trang giới thiệu, đăng ký, đăng nhập, đổi ngôn ngữ |
| Người học | Người đã đăng nhập. Dùng mọi chức năng; là chủ sở hữu của tài liệu, kho từ, bộ thẻ, đề, bài làm của mình |
| Gemini AI | Hệ thống ngoài. Chỉ được gọi qua AI gateway của server |
| Đồng hồ hệ thống | Thời gian của server. Kích hoạt tự nộp bài khi hết giờ |

**Quy ước chung cho mọi use case của Người học:** tiền điều kiện luôn gồm "đã đăng nhập". Hết phiên đăng nhập thì chuyển về `/login?next=<trang hiện tại>`. Mọi thông báo hiển thị theo ngôn ngữ giao diện đang chọn.

---

## UC12 — Tra từ theo ngữ cảnh
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Đang mở một tài liệu trong trình đọc (UC11) |
| Luồng chính | 1. Người học bôi chọn một từ hoặc cụm từ (tối đa 6 từ). 2. Trình đọc hiện nút "Giải thích" (hoặc phím tắt). 3. Client gửi từ + câu chứa từ. 4. Server tra AiCache; không có thì gọi Gemini qua AI gateway, kiểm tra kết quả bằng schema, lưu cache. 5. Server ghi `VocabLookup`, trả về: nghĩa tiếng Việt **đúng trong câu này**, định nghĩa tiếng Anh, IPA, loại từ, cách dùng, collocations, CEFR, chủ đề. 6. Trình đọc hiện popover giải thích |
| Luồng thay thế / lỗi | 1a. Chọn quá 6 từ: nút Giải thích bị khóa, có gợi ý. 4a. Hết quota AI trong ngày: báo lỗi 429 kèm thời điểm được dùng lại. 4b. Gemini lỗi sau 2 lần thử lại: báo 503 "AI đang bận, thử lại sau" |
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

## UC20 / UC21 — Tạo và sửa bộ thẻ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | UC21: là chủ sở hữu bộ thẻ |
| Luồng chính | 1. Người học mở trình soạn, nhập tiêu đề, mô tả. 2. Thêm, sửa, xóa, kéo đổi thứ tự các hàng thuật ngữ / định nghĩa / ví dụ. 3. Bấm "Lưu". 4. Server ghi lại toàn bộ danh sách thẻ trong một lần: thẻ cũ thì cập nhật, thẻ mới thì thêm, thẻ bị bỏ thì xóa |
| Luồng thay thế / lỗi | 2a. (Nên có) Dán nhiều dòng `thuật ngữ<Tab>định nghĩa` để thêm nhanh. 3a. Bộ thẻ cần ít nhất 2 thẻ có đủ thuật ngữ và định nghĩa, nếu không thì báo lỗi theo hàng. 3b. Rời trang khi chưa lưu: hỏi xác nhận |
| Hậu điều kiện | Bộ thẻ được lưu; tiến độ học của các thẻ còn giữ không đổi |

## UC23 — Tạo bộ thẻ từ kho từ
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Có từ trong kho |
| Luồng chính | 1. Ở kho từ, người học chọn nhiều từ, bấm "Tạo bộ thẻ" (hoặc bấm từ toast sau khi lưu từ). 2. Trình soạn mở với các thẻ điền sẵn: thuật ngữ = headword, định nghĩa = nghĩa tiếng Việt, ví dụ = câu gốc. 3. Tiếp tục như UC20 |
| Luồng thay thế / lỗi | 1a. Chọn vào bộ thẻ có sẵn thay vì bộ mới: thêm thẻ vào cuối bộ đó (chỉ bộ của mình) |
| Hậu điều kiện | Thẻ liên kết `vocabEntryId` |

## UC25 — Học theo lặp lại ngắt quãng
| | |
|---|---|
| Actor | Người học |
| Tiền điều kiện | Bộ thẻ có thẻ đến hạn hoặc thẻ mới |
| Luồng chính | 1. Người học chọn chế độ "Học". 2. Server mở phiên học, trả các thẻ đến hạn + thẻ mới (giới hạn mỗi ngày theo giờ Việt Nam). 3. Mỗi thẻ: xem mặt trước → lật (phím cách) → chấm Again / Hard / Good / Easy (phím 1–4). 4. Server cập nhật SM-2, ghi `ReviewLog`. Thẻ "Again" được hỏi lại trong phiên. 5. Hết thẻ: tổng kết phiên, đóng phiên học |
| Luồng thay thế / lỗi | 2a. Không có thẻ nào: báo "Hôm nay đã ôn xong", gợi ý chế độ Thẻ lật. 3a. Thoát giữa chừng: các thẻ đã chấm vẫn được lưu; phiên đóng khi rời trang |
| Hậu điều kiện | `CardProgress` cập nhật; có `StudySession`, `ReviewLog` |

## UC30 — Tải đề lên
| | |
|---|---|
| Actor | Người học, Gemini AI |
| Tiền điều kiện | Có bộ file đúng quy định (PLAN Phần F) |
| Luồng chính | 1. Người học chọn loại đề (Reading / Listening / Full), kéo thả các file. 2. Client kiểm tra sơ bộ (đủ file, đúng định dạng, dung lượng). 3. Server lưu file, tạo `TestImport` (`queued`), trả về ngay. 4. Job nền: AI nhận diện PDF đề thành cấu trúc; AI đọc PDF đáp án và gán đáp án vào đúng kỹ năng và số câu. 5. Server kiểm tra: số câu từng phần đúng theo chứng chỉ, câu nào cũng có đáp án, đáp án hợp lệ với dạng câu, audio đọc được. 6. Lưu thành đề **riêng tư**. 7. Client (hỏi trạng thái mỗi vài giây) báo hoàn tất, đề xuất hiện trong "Đề của tôi" |
| Luồng thay thế / lỗi | 2a. Thiếu file hoặc sai định dạng: báo ngay, không gửi lên. 5a. Kiểm tra không đạt: `TestImport` = `failed`, hiện danh sách lỗi theo từng câu (ví dụ "Reading câu 27: thiếu đáp án"). 4a. AI lỗi hoặc hết quota: `failed` với lỗi tương ứng, cho thử lại |
| Hậu điều kiện | Có `Test` riêng tư, hoặc `TestImport` thất bại kèm lỗi |

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

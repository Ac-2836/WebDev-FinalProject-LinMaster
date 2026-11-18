# LinMaster — Working Rules

Luật và quy trình bắt buộc khi làm dự án LinMaster. Áp dụng cho **mọi người tham gia**: hai thành viên nhóm và các AI Agent (Claude Code / Opus 5.5, hoặc bất kỳ agent nào khác).

- Luật nào ghi **[Người]** chỉ áp dụng cho thành viên. Luật nào ghi **[AI]** chỉ áp dụng cho AI Agent. Không ghi gì thì áp dụng cho cả hai.
- Từ **"phải"** là bắt buộc, **"không được"** là cấm, **"nên"** là khuyến nghị.

**Thứ tự ưu tiên khi các tài liệu mâu thuẫn:** yêu cầu trực tiếp của thành viên phụ trách > `Working_rules.md` > `Project_Structure.md` > `PLAN.md`.

---

## Mục lục

1. [Chuẩn đầu ra và luật tương ứng](#1-chuẩn-đầu-ra-và-luật-tương-ứng)
2. [Vai trò và quyền hạn](#2-vai-trò-và-quyền-hạn)
3. [Luật riêng cho AI Agent](#3-luật-riêng-cho-ai-agent)
4. [Vòng đời một task](#4-vòng-đời-một-task)
5. [Git: branch, commit, pull request, review](#5-git-branch-commit-pull-request-review)
6. [Quản lý công việc bằng Kanban](#6-quản-lý-công-việc-bằng-kanban)
7. [Quy chuẩn code](#7-quy-chuẩn-code)
8. [REST API và API doc](#8-rest-api-và-api-doc)
9. [Database](#9-database)
10. [Tích hợp AI (Gemini)](#10-tích-hợp-ai-gemini)
11. [Bảo mật](#11-bảo-mật)
12. [Testing](#12-testing)
13. [Deploy và quản lý website](#13-deploy-và-quản-lý-website)
14. [Nội dung đề thi](#14-nội-dung-đề-thi)
15. [Tài liệu, report, thuyết trình](#15-tài-liệu-report-thuyết-trình)
16. [Checklist](#16-checklist)

---

## 1. Chuẩn đầu ra và luật tương ứng

| Chuẩn của giảng viên | Mức | Được đáp ứng bởi |
|---|---|---|
| Lịch sử PR đều đặn, quản lý dự án sát thực tế | Cao | Mục 4, 5, 6 (Kanban trên GitHub Projects) |
| Publishment tốt: deploy, quản lý website, tên miền | Cao | Mục 13 |
| Có database | Tối thiểu | Mục 9 |
| Có API doc (bắt buộc dùng Swagger) | Tối thiểu | Mục 8.4 |
| Hoàn thành chức năng ở mức chấp nhận được | Tối thiểu | Mục 4 (Definition of Done), mục 12 |
| Thuyết trình, report ổn | Tối thiểu | Mục 15 |

---

## 2. Vai trò và quyền hạn

| Vai trò | Phụ trách | Review PR của |
|---|---|---|
| **Khai Hung** — Front-end, Database & AI | Toàn bộ client (giao diện, responsive, a11y), schema database, AI gateway và mọi task AI, mock data và seed, board GitHub Projects | Tien Hung |
| **Tien Hung** — Back-end & DevOps | Hạ tầng server, auth, CRUD, SM-2, chấm điểm, phần không phải AI của luồng tải đề, library, API dashboard, CI, deploy, test e2e, tên miền | Khai Hung |
| **AI Agent** | Viết code, test, API doc theo issue được giao; đề xuất giải pháp | Không review thay người |

| Hành động | Thành viên | AI Agent |
|---|---|---|
| Tạo Issue khi phát hiện việc mới (mục 6.4) | ✅ ai phát hiện thì người đó tạo | Chỉ **đề xuất** nội dung issue |
| Nhận việc (kéo thẻ, gán mình vào Assignees) | ✅ theo luật kéo việc (mục 6.3) | ❌ |
| Viết code, test, tài liệu kỹ thuật | ✅ | ✅ trong phạm vi issue được giao |
| Commit trên branch tính năng | ✅ | Chỉ khi thành viên phụ trách yêu cầu |
| Push, mở PR | ✅ bằng tài khoản của mình | ❌ |
| Duyệt, merge PR | ✅ (cần được duyệt và CI xanh; KH được tự duyệt PR của mình) | ❌ |
| Thêm dependency, đổi tech stack | ✅ khi cả nhóm đồng ý | ❌ chỉ đề xuất |
| Sửa `Working_rules.md`, `Project_Structure.md` | ✅ qua PR, cả nhóm đồng ý | ❌ chỉ đề xuất |
| Quyết định thiết kế, phạm vi, nội dung đề, report, slide | ✅ | ❌ chỉ góp ý |
| Truy cập dashboard Vercel/Render/Neon/Cloudflare, secret | ✅ | ❌ |

---

## 3. Luật riêng cho AI Agent

### 3.1. Trước khi bắt đầu một task [AI]
1. **Phải** đọc, theo thứ tự: `README.md` → `docs/Working_rules.md` → `docs/Project_Structure.md` → phần liên quan trong `docs/PLAN.md` → nội dung Issue.
2. **Phải** đọc phần code hiện có mà task sẽ chạm tới (file liên quan, nơi gọi tới, test) trước khi sửa.
3. Nếu Issue không rõ tiêu chí hoàn thành, hoặc mâu thuẫn với tài liệu, **phải** hỏi lại thành viên phụ trách trước khi code. **Không được** tự đoán các quyết định thiết kế.

### 3.2. Trong khi làm [AI]
4. **Chỉ** làm trong phạm vi Issue. Thấy việc khác cần làm (bug, refactor, tính năng) thì ghi lại thành đề xuất Issue mới, **không** tự làm luôn.
5. **Phải** theo đúng cấu trúc thư mục trong `Project_Structure.md` và quy chuẩn code ở mục 7. Code mới phải giống phong cách code xung quanh.
6. **Không được** thêm dependency mới, đổi phiên bản thư viện, hay đổi tech stack nếu chưa được đồng ý. Ưu tiên dùng thứ đã có trong dự án.
7. **Không được** bịa dữ liệu thật: đề thi, đáp án, transcript, số liệu thống kê. Dữ liệu mẫu cho test phải ghi rõ là dữ liệu mẫu.
8. **Không được** đọc, in ra, ghi vào code/log/test, hay gửi đi bất kỳ secret nào (API key, mật khẩu DB, JWT secret). Cần biến môi trường mới thì thêm **tên** biến vào `.env.example`.
9. **Không được** gọi Gemini API thật trong test. Phải mock.
10. **Không được** sửa file cấu hình CI, branch protection hay deploy, trừ khi Issue yêu cầu đúng việc đó.

### 3.3. Git [AI]
11. **Không được** push, mở PR, merge, tạo tag hay release. Những việc này do thành viên làm.
12. **Không được** commit thẳng vào `main`, force push, rebase hay sửa lịch sử đã push, hay đổi ngày commit.
13. Chỉ commit khi thành viên phụ trách yêu cầu. Commit message theo mục 5.2 và **không** chèn dòng đồng tác giả AI. Việc nhóm dùng AI đã được công khai trong `PLAN.md` và report.

### 3.4. Bàn giao [AI]
14. **Phải** tự chạy `lint`, `test` và `build` của phần bị ảnh hưởng trước khi bàn giao.
15. Báo cáo bàn giao **phải** có đủ:
    - Đã thay đổi gì, ở file nào.
    - Cách kiểm tra lại.
    - Kết quả lint/test/build **đúng như thực tế**: lỗi thì ghi là lỗi, kèm output.
    - Những gì **chưa** kiểm tra được, rủi ro, và các việc cố ý bỏ qua.
16. Nếu thay đổi làm tech stack, thư mục cấp cao hoặc nguyên tắc tổ chức code khác với `Project_Structure.md`, **phải** nói rõ để thành viên cập nhật tài liệu. Thêm hay đổi file đơn lẻ thì không cần.

### 3.5. Thành viên làm việc với AI [Người]
17. **Phải** đọc và hiểu toàn bộ code AI viết trước khi mở PR. Người mở PR chịu trách nhiệm về code như code tự viết, và phải tự giải thích được khi vấn đáp.
18. Giao việc cho AI theo **từng Issue**, kèm link Issue và tiêu chí hoàn thành. Không giao "làm cả module".
19. **Không được** dán secret thật vào cuộc trò chuyện với AI.

---

## 4. Vòng đời một task

```
Issue ─▶ Branch ─▶ Code ─▶ Tự kiểm tra ─▶ Pull Request ─▶ Review ─▶ CI xanh ─▶ Squash merge ─▶ Done
```

| Bước | Ai | Việc | Cột trên board Kanban |
|---|---|---|---|
| 1. Issue | Người | Tạo Issue theo template (Task / Bug / Idea): mô tả, tiêu chí hoàn thành, label, Module, Cỡ | Backlog |
| 2. Làm rõ | Cả nhóm (buổi xem lại tuần) | Đủ tiêu chí hoàn thành, các việc cần trước đã xong → chuyển sang Ready | Ready |
| 3. Kéo việc | Người rảnh tay | Lấy thẻ **trên cùng** của Ready, gán mình vào Assignees (mục 6.3) | In progress |
| 4. Branch + code | Người / AI | Branch từ `main` mới nhất (mục 5.1); code, test, cập nhật API doc nếu có | In progress |
| 5. Tự kiểm tra | Người / AI | `lint`, `typecheck`, `test`, `build` chạy qua ở máy; chạy thử luồng thật | In progress |
| 6. Pull Request | Người | Mở PR theo template, gắn `Closes #<issue>`. Board tự chuyển thẻ | In review |
| 7. Review | Người còn lại hoặc QA | Review theo mục 5.4, chạy thử trên link preview | In review |
| 8. Merge | Người mở PR | Đã được duyệt (người còn lại hoặc QA kết luận Đạt; KH được tự duyệt PR của mình) + CI xanh → Squash and merge, xóa branch. Issue tự đóng | Done |

### Definition of Done
Một task **chỉ** được coi là xong khi đủ các điều sau:
- [ ] Đạt hết tiêu chí hoàn thành trong Issue.
- [ ] Lint, test, build đều chạy qua; CI xanh.
- [ ] Logic không đơn giản (chấm điểm, SM-2, quy đổi band, phân tích file) có unit test.
- [ ] Endpoint mới hoặc thay đổi đã được đăng ký vào API doc và hiển thị đúng trên Swagger UI (`/docs`).
- [ ] Đổi schema DB thì có migration đi kèm.
- [ ] Đổi giao diện thì PR có ảnh chụp, đã thử trên desktop và mobile, dùng được bằng bàn phím.
- [ ] Đã chạy thử trên bản preview deploy của PR.
- [ ] Đã được duyệt và merge vào `main`.

---

## 5. Git: branch, commit, pull request, review

### 5.1. Branch
- Nhánh chính duy nhất là `main`, luôn ở trạng thái deploy được.
- Branch tính năng đặt tên `<loại>/<số-issue>-<mô-tả-ngắn>`, viết chữ thường, nối bằng `-`.
  - Ví dụ: `feat/12-cbt-timer`, `fix/30-highlight-offset`, `docs/41-api-doc-auth`, `chore/5-setup-ci`.
  - Giai đoạn đầu dự án một số branch dùng mã việc của PLAN thay cho số issue (ví dụ `feat/p1-06-auth-server`); từ đợt sửa lỗi dùng số issue (ví dụ `fix/221-...`).
- Mỗi branch chỉ phục vụ **một** Issue. Merge xong thì xóa.

### 5.2. Commit — [Conventional Commits](https://www.conventionalcommits.org/)

```
<loại>(<phạm vi>): <mô tả ngắn bằng tiếng Anh, động từ ở thể mệnh lệnh>

<thân: giải thích vì sao, nếu cần>

Refs #12
```

| Loại | Dùng khi |
|---|---|
| `feat` | Thêm tính năng |
| `fix` | Sửa bug |
| `docs` | Chỉ sửa tài liệu |
| `style` | Định dạng, không đổi logic |
| `refactor` | Sắp xếp lại code, không đổi hành vi |
| `test` | Thêm hoặc sửa test |
| `chore` | Cấu hình, dependency, CI, công cụ |

- **Phạm vi:** theo module hoặc khu vực: `auth`, `vocab`, `flashcard`, `exam`, `library`, `stats`, `client`, `server`, `api`, `db`, `ai`, `storage`, `e2e`, `ci`, `deploy`, `readme`.
- **Ví dụ:** `feat(exam): add countdown timer synced with server start time`.
- Mỗi commit là một bước hợp lý, chạy được. Không gom cả ngày vào một commit, không ghi message vô nghĩa như `update`, `fix bug`.

### 5.3. Pull Request
- **Nhỏ, chỉ làm một việc**, khoảng dưới 400 dòng thay đổi (không tính file sinh tự động như migration hay lockfile). Việc lớn thì chia nhiều PR.
- **Tiêu đề** viết theo dạng commit message. Sau khi squash, tiêu đề này thành commit trên `main`.
- **Mô tả** theo template, gồm:
  - Làm gì, vì sao.
  - Cách test.
  - Ảnh chụp màn hình (nếu đổi giao diện).
  - Thay đổi về API / DB / biến môi trường (nếu có).
  - `Closes #<issue>`.
- PR chưa xong thì mở dạng **Draft**.
- Chỉ merge khi đã được duyệt (người còn lại hoặc QA kết luận Đạt; KH được tự duyệt PR của mình) và CI xanh. **Không được** merge khi CI đỏ.

### 5.4. Review (theo [Google Engineering Practices](https://google.github.io/eng-practices/))
- Review trong vòng **24 giờ** kể từ khi PR được mở hoặc cập nhật.
- **Phải** chạy thử trên link preview, không bấm Approve suông.
- Kiểm tra theo thứ tự:
  1. Thiết kế có hợp lý không.
  2. Logic có đúng không, kể cả trường hợp biên.
  3. Bảo mật.
  4. Test.
  5. Tên gọi, độ dễ đọc.
  6. Comment, tài liệu.
- Mỗi PR có ít nhất **một nhận xét cụ thể**. Góp ý nhỏ không bắt buộc sửa thì ghi tiền tố `Nit:`.
- Code tốt hơn trước là duyệt được, không đòi hoàn hảo.
- Góp ý về code, không nhắm vào người. Nêu lý do khi yêu cầu sửa.

### 5.5. Bảo vệ `main`
- Bắt buộc merge qua PR, cần được duyệt, CI phải xanh: job `check` (lint, typecheck, migrate, test, build, gồm kiểm tra mọi route có trong Swagger) và job `e2e` (Playwright).
- Cấm push thẳng, cấm force push, cấm xóa nhánh.
- Lỗi gấp trên production vẫn đi qua PR (`fix/<issue>-...`), người review ưu tiên xử lý ngay.
- Repo là **public** và chưa bật branch protection trên GitHub, nên các luật trên vẫn bắt buộc và được tuân thủ thủ công.

---

## 6. Quản lý công việc bằng Kanban

Nhóm dùng **Kanban** trên **GitHub Projects** (Project "LinMaster"), không dùng tool ngoài. Lý do: nhóm chỉ có 2 người và thời gian ngắn. Kanban không cần thêm vai trò hay nhiều buổi họp, nhưng vẫn giữ board luôn đúng thực tế và PR đều đặn nhờ giới hạn WIP.

### 6.1. Board và các cột

```
Backlog ──▶ Ready ──▶ In progress ──▶ In review ──▶ Done
```

| Cột | Ý nghĩa | Giới hạn WIP |
|---|---|---|
| **Backlog** | Mọi việc đã biết nhưng chưa sẵn sàng làm. Việc mới phát sinh luôn vào đây trước | Không giới hạn |
| **Ready** | Đã đủ rõ để bắt tay làm ngay: có mô tả, tiêu chí hoàn thành, các việc cần trước đã xong. Sắp theo ưu tiên, trên cùng là việc cần làm nhất | Không giới hạn |
| **In progress** | Đang code, đã có người nhận | **Tối đa 2 thẻ mỗi người** |
| **In review** | Đã mở PR, đang chờ review hoặc đang sửa theo review | **Tối đa 3 thẻ toàn nhóm** |
| **Done** | Đã merge vào `main`, đạt Definition of Done (mục 4) | — |

**Các trường của mỗi thẻ:** Status (cột), Priority (Gấp / Cao / Thường / Thấp), Module, Cỡ (S / M / L), Phụ trách, Mã (`Pn-xx` trong PLAN nếu có), Assignees.

**Labels:** `module:*`, `type:feature|chore|devops|test|docs|content|release`, `bug`, `idea`, `blocked`, `size:S|M|L`.

**Các view:**

| View | Kiểu | Dùng để |
|---|---|---|
| Kanban | Board | Làm việc hằng ngày |
| Backlog | Table | Sắp ưu tiên, làm rõ việc trong buổi xem lại tuần |
| Của tôi | Board, lọc `assignee:@me` | Xem việc của mình |
| Theo giai đoạn | Board, nhóm theo trường Giai đoạn | Xem tiến độ từng giai đoạn của PLAN |
| Roadmap | Roadmap | Nhìn tổng thể theo thời gian, đưa vào report |

**Tự động hóa (Workflows của Project):**
- Issue/PR mới của repo tự thêm vào board, vào cột Backlog.
- PR được mở → thẻ sang In review.
- PR merge hoặc issue đóng → thẻ sang Done.

### 6.2. Khởi đầu: nạp backlog
- Mọi việc **bắt buộc** trong `PLAN.md` Phần D được tạo thành Issue, mỗi việc một Issue, ghi mã `Pn-xx` trong tiêu đề.
- Sắp thứ tự trong Backlog theo thứ tự và phụ thuộc trong PLAN. Các việc đã đủ điều kiện làm ngay thì chuyển sang Ready.

### 6.3. Luật kéo việc (pull) và giới hạn WIP
- **Không giao việc theo kiểu đẩy.** Ai rảnh tay thì tự **kéo thẻ trên cùng của Ready** về mình, gán Assignees, rồi chuyển sang In progress.
  - Được bỏ qua thẻ trên cùng nếu nó không thuộc vai trò của mình (ví dụ việc front-end với người phụ trách back-end).
- **Tôn trọng giới hạn WIP.** Đang có đủ 2 thẻ ở In progress thì **không** kéo việc mới. Thay vào đó, ưu tiên theo thứ tự:
  1. Review PR đang chờ.
  2. Gỡ việc đang kẹt.
  3. Hoàn thành việc dở.
- Cột In review chạm giới hạn 3 thẻ thì cả nhóm dừng code mới để review cho xong.
- Một thẻ chỉ có **một** người phụ trách chính. Cần người kia giúp thì ghi vào comment.
- Thẻ ở In progress quá **2 ngày** thì phải tách nhỏ, hoặc gắn `blocked` kèm lý do.

### 6.4. Việc phát sinh: khi nào tạo Issue mới

| Tình huống | Tạo Issue mới? | Cách xử lý |
|---|---|---|
| Lỗi tìm thấy khi review một PR, nằm trong phạm vi PR đó | **Không** | Comment trong PR, chủ PR sửa trên cùng branch |
| Lỗi trên `main` / production | **Có**, label `bug` | Ghi cách tái hiện, mức độ, module. Vào Backlog, hoặc Ready nếu cần làm ngay |
| Lỗi **gấp** (sập trang, demo không chạy) | **Có**, `bug` + Priority **Gấp** | Đặt lên đầu Ready. **Là trường hợp duy nhất được vượt giới hạn WIP** |
| Đang làm thì thấy việc ngoài phạm vi Issue (refactor, thiếu tính năng nhỏ) | **Có** | Tạo Issue mới vào Backlog. **Không** làm luôn trong PR hiện tại |
| Việc đang làm hóa ra quá lớn (cỡ L, quá 400 dòng) | Tách nhỏ | Tạo sub-issue hoặc chia thành nhiều Issue nhỏ |
| Ý tưởng hay nhưng ngoài MVP | **Có**, label `idea` | Để cuối Backlog, xem lại trong buổi tuần |

- **Ai phát hiện việc thì người đó tạo Issue.** Issue mới **luôn vào Backlog trước**, không nhảy thẳng sang In progress. Lỗi gấp là ngoại lệ duy nhất.
- Trước khi tạo, tìm xem đã có Issue trùng chưa. Trùng thì comment vào Issue cũ.
- **[AI]** AI Agent chỉ soạn nội dung Issue đề xuất (mục 3.2), người tạo Issue trên GitHub.

### 6.5. Nhịp làm việc

| Nhịp | Việc cần làm | Ai |
|---|---|---|
| **Đầu ngày** | Mở view Kanban. Thứ tự ưu tiên: review PR đang chờ → làm tiếp việc dở → kéo việc mới từ Ready | Mỗi người |
| **Trong ngày** | Mỗi người ít nhất **1 PR** được mở hoặc merge (mục tiêu 1–3). Thẻ luôn nằm đúng cột. Vướng mắc thì comment vào Issue và gắn `blocked` | Mỗi người |
| **Daily (online, không bắt buộc)** | 2–3 dòng trong bài Discussions của tuần: hôm qua xong gì, hôm nay làm gì, vướng gì | Mỗi người |
| **Xem lại tuần (~30 phút)** | Biên bản đăng ở **GitHub Discussions** (mục *Meetings*), theo mục 6.6 | Cả nhóm |
| **Release** | Tại các mốc trong PLAN: tag `vX.Y` kèm release notes trên GitHub Releases, kiểm tra production | Người nhận issue release trong PLAN (`v0.1`, `v0.2`: Tien Hung; `v1.0`: Khai Hung) |

### 6.6. Buổi xem lại hằng tuần
1. **Đã xong gì:** số thẻ Done trong tuần, link release (nếu có).
2. **Thẻ kẹt:** thẻ ở In progress hoặc In review quá 2 ngày, thẻ `blocked`. Xử lý những thẻ này trước tiên.
3. **Sắp lại Backlog:**
   - Phân loại các Issue mới phát sinh: giữ, gộp hay đóng với lý do *not planned*.
   - Đặt Priority.
   - Chuyển các việc đủ điều kiện sang Ready cho tuần tới.
4. **Đối chiếu với PLAN:** trễ thì cắt phạm vi theo thứ tự cắt giảm trong `PLAN.md` Phần G.
5. **Chỉnh luật nếu cần:** giới hạn WIP còn hợp lý không, có nên tách việc nhỏ hơn không.

### 6.7. Đo lường (dùng cho report)
- Tab **Insights** của Project: biểu đồ số thẻ theo Status qua thời gian (tương tự Cumulative Flow Diagram), số thẻ Done mỗi tuần.
- Thời gian từ lúc kéo thẻ tới lúc Done (lead time), tính bằng `gh` từ lịch sử Issue/PR khi viết report.

### 6.8. Lịch sử phải phản ánh đúng thực tế
- Làm đều mỗi ngày, không dồn vào cuối tuần hay sát hạn nộp.
- **Không được** sửa ngày commit, viết lại lịch sử đã push, hay tạo commit/PR chỉ để tăng số lượng.
- Mọi quyết định quan trọng phải để lại dấu vết trên GitHub (Issue, PR, Discussions), không chỉ nằm trong tin nhắn riêng.

---

## 7. Quy chuẩn code

Dự án theo các style guide của Google. Khi có điểm chưa rõ, bản gốc là chuẩn cuối cùng:
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)
- [Google API Design Guide](https://cloud.google.com/apis/design)
- [Google JSON Style Guide](https://google.github.io/styleguide/jsoncstyleguide.xml)

### 7.1. Công cụ tự động
- **[gts](https://github.com/google/gts)** (ESLint + Prettier của Google) dùng cho mọi workspace. Riêng `client/` thêm vài tùy chọn parser (`parserOptions`) trong `eslint.config.js`.
- Lệnh `npm run lint` để kiểm tra, `npm run fix` để tự sửa.
- CI chạy lint trên mỗi PR, lint lỗi thì không merge được.
- **Định dạng do máy lo:** thụt lề 2 dấu cách, dòng tối đa 120 ký tự (nới từ mặc định 80 của gts cho phù hợp với JSX và class Tailwind), có dấu `;`, dùng nháy đơn. Không tranh cãi về định dạng trong review.

### 7.2. Đặt tên

| Loại | Kiểu viết | Ví dụ |
|---|---|---|
| Class, interface, type, enum, React component | `UpperCamelCase` | `TestAttempt`, `CbtTimer` |
| Biến, hàm, tham số, thuộc tính, method | `lowerCamelCase` | `dueCards`, `calculateBand()` |
| Hằng số cấp module, giá trị enum | `CONSTANT_CASE` | `MAX_UPLOAD_MB`, `Skill.READING` |
| Tên file, tên thư mục | chữ thường, nối bằng `-` | `cbt-timer.tsx`, `file-parser.ts` |
| React hook | bắt đầu bằng `use` | `useCountdown` |
| File test | `<tên-file>.test.ts` | `srs.test.ts` |

- **Từ viết tắt viết như một từ thường:** `userId`, `apiKey`, `loadHttpUrl`. Không viết `userID`, `APIKey`.
- **Không** dùng tiền tố `I` cho interface, **không** dùng `_` cho biến private, **không** viết tắt tùy tiện (`cnt`, `tmp`, `data2`).
- Code, comment, tên biến viết bằng **tiếng Anh**. Text hiển thị cho người dùng viết bằng **tiếng Việt**.

### 7.3. TypeScript
- Dùng `const`, khi cần gán lại thì dùng `let`. **Không** dùng `var`.
- **Named export.** Ngoại lệ là các file Next.js bắt buộc default export (`page.tsx`, `layout.tsx`, `template.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`).
- **Không** dùng `any`. Chưa biết kiểu thì dùng `unknown` rồi thu hẹp. **Không** dùng `@ts-ignore`.
- Luôn dùng `===` / `!==` (gts báo lỗi cả `== null`). Cần kiểm tra cả `null` lẫn `undefined` thì dùng `??`, `?.` hoặc so sánh tường minh.
- Mô tả object dùng `interface`. Union, tuple, kiểu tính toán dùng `type`.
- Trường không bắt buộc viết `name?: string`.
- Ném lỗi luôn dùng `throw new Error(...)` (hoặc class lỗi của dự án), không throw chuỗi.
- Dùng ES module. Không dùng `namespace` hay `require`.
- Không có magic number. Ví dụ: `const LISTENING_REVIEW_SECONDS = 120;`.
- Comment:
  - Tài liệu cho hàm, class, export dùng JSDoc `/** ... */`.
  - Trong thân hàm dùng `//`, chỉ giải thích **vì sao**, không kể lại code đang làm gì.

### 7.4. React / Next.js
- Mặc định là Server Component. Chỉ thêm `'use client'` khi cần state, effect hay sự kiện trình duyệt.
- Mỗi file một component chính, tên component khớp tên file (`cbt-timer.tsx` → `CbtTimer`).
- Props khai báo bằng `interface <TênComponent>Props`.
- Logic dùng lại ở nhiều chỗ thì tách thành custom hook trong feature của module (hoặc trong `core` nếu dùng toàn app). Component chỉ lo phần hiển thị.
- Gọi API **chỉ** qua API client của `core`, không rải `fetch` khắp nơi.

### 7.5. HTML / CSS / giao diện
- Dùng thẻ đúng ngữ nghĩa:
  - `<button>` cho hành động, `<a>` cho điều hướng. **Không** dùng `<div onClick>`.
  - Mọi input có `<label>`.
- Mọi ảnh có `alt`, mọi nút chỉ có icon có `aria-label`. Thao tác được bằng bàn phím, có viền focus rõ ràng.
- Độ tương phản chữ tối thiểu 4.5:1. Vùng bấm tối thiểu 44×44px.
- Ưu tiên class của Tailwind và component của shadcn/ui.
  - Màu, bo góc, khoảng cách lấy từ theme (CSS variables), **không** viết cứng mã màu.
  - Viết CSS riêng thì đặt tên class chữ thường, nối bằng `-`, theo ý nghĩa: `.question-nav` ✅, `.blue-box` ❌.
- Mọi trang phải dùng được ở bề rộng 375px.

### 7.6. Ranh giới module
Kiến trúc module được mô tả ở [PLAN.md](PLAN.md) Phần B. Các luật sau là bắt buộc để các module phát triển song song mà không xung đột:
- **Mỗi PR chỉ chạm vào một module** (cộng thêm phần `shared` của module đó). Cần sửa `core` thì tách thành PR riêng và merge trước.
- Module khác chỉ được gọi qua **public API** của module. **Không** import file nội bộ của module khác.
- Mỗi bảng thuộc **một module**. Chỉ module sở hữu được ghi vào bảng đó.
- Phụ thuộc đi **một chiều** theo PLAN.md mục B2. **Không** tạo phụ thuộc ngược hay phụ thuộc vòng. Cần ghép dữ liệu của module "trên" vào trang của module "dưới" thì client tự gọi cả hai API.
- Ở client, feature **không** import feature khác. Liên kết giữa các trang dùng URL + query.
- Thêm chức năng ở chỗ đã có registry thì **thêm một mục vào registry**, không sửa code xử lý chung.
- File đăng ký dùng chung (module registry, nav, widget): mỗi module chỉ thêm đúng một dòng của mình.
- **API trước, giao diện sau:** PR server của endpoint merge trước PR client dùng endpoint đó.

---

## 8. REST API và API doc

### 8.1. Thiết kế endpoint
- URL là **danh từ số nhiều**, chữ thường, nối bằng `-`: `/tests`, `/attempts/:id`, `/flashcards/reviews`.
- Mọi endpoint nằm dưới tiền tố phiên bản `/api/v1`.

| Thao tác | Method | Ví dụ | Mã thành công |
|---|---|---|---|
| Lấy danh sách | GET | `GET /api/v1/vocab/entries` | 200 |
| Lấy một bản ghi | GET | `GET /api/v1/vocab/entries/:id` | 200 |
| Tạo mới | POST | `POST /api/v1/flashcards/sets` | 201 |
| Cập nhật một phần | PATCH | `PATCH /api/v1/flashcards/sets/:id` | 200 |
| Ghi đè | PUT | `PUT /api/v1/attempts/:id/state` | 200 |
| Xóa | DELETE | `DELETE /api/v1/vocab/entries/:id` | 204 |
| Hành động đặc biệt | POST | `POST /api/v1/attempts/:id/submit` | 200 |

*Điều chỉnh so với Google:* Google viết hành động đặc biệt dạng `/attempts/123:submit`. Dự án dùng `/attempts/:id/submit` vì Express đã dùng dấu `:` cho tham số đường dẫn.

### 8.2. Dữ liệu
- Tên trường JSON dùng `lowerCamelCase`.
- Thời gian theo chuẩn RFC 3339, giờ UTC: `"2026-11-02T08:30:00Z"`.
- Phân trang theo trang: `?page=1&pageSize=20`, response trả kèm `pagination { page, pageSize, total, totalPages }`.
- Xác thực bằng header `Authorization: Bearer <JWT>`.
- Mọi input **phải** được validate bằng Zod ở tầng route trước khi vào service.

### 8.3. Lỗi
Mọi lỗi trả về cùng một dạng:
```json
{ "error": { "code": 400, "status": "INVALID_ARGUMENT", "message": "Field 'email' must be a valid email address." } }
```

| HTTP | `status` | Khi nào |
|---|---|---|
| 400 | `INVALID_ARGUMENT` | Dữ liệu gửi lên sai |
| 401 | `UNAUTHENTICATED` | Thiếu JWT hoặc JWT hết hạn |
| 403 | `PERMISSION_DENIED` | Truy cập dữ liệu của người khác |
| 404 | `NOT_FOUND` | Không tìm thấy |
| 409 | `ALREADY_EXISTS` / `FAILED_PRECONDITION` | Trùng email; bài thi đã nộp |
| 413 / 415 | `INVALID_ARGUMENT` | File hoặc văn bản quá lớn / sai định dạng |
| 422 | `FAILED_PRECONDITION` hoặc mã riêng (`SET_EMPTY`, `IMPORT_INCOMPLETE`, `EXPLAIN_NO_TEXT`) | Dữ liệu hợp lệ nhưng chưa đủ điều kiện xử lý |
| 429 | `RESOURCE_EXHAUSTED` | Quá giới hạn tần suất (ví dụ 20 lượt AI mỗi phút) |
| 429 | `AI_QUOTA_EXCEEDED` | Hết 50 lượt AI trong ngày; `details.retryAt` là lúc được dùng lại |
| 500 | `INTERNAL` | Lỗi server. **Không** lộ stack trace hay chi tiết lỗi ra ngoài |
| 500 | `AI_REQUEST_REJECTED` | Model AI từ chối chính yêu cầu (lỗi của hệ thống, không thử lại) |
| 502 | `AI_INVALID_OUTPUT` | AI trả kết quả sai định dạng hoặc thiếu nội dung sau 3 lần gọi |
| 503 | `AI_UNAVAILABLE` | Không gọi được AI sau khi thử lại, hoặc chưa cấu hình khóa |

### 8.4. API doc — Swagger (bắt buộc)
Giảng viên yêu cầu API doc dùng **Swagger**. Dự án làm như sau:

- **Sinh doc từ code:** đặc tả OpenAPI 3 được **sinh tự động từ các Zod schema** đang dùng để validate request/response, bằng thư viện `@asteasolutions/zod-to-openapi`. **Không** viết tay file YAML/JSON, để doc luôn khớp với code.
- **Đăng ký endpoint:** mỗi endpoint phải được đăng ký vào registry của OpenAPI ngay cạnh route của nó, gồm:
  - Tóm tắt và mô tả.
  - Tag theo module (`Core`, `Auth`, `Vocab`, `Documents`, `Flashcard`, `Exam`, `Library`, `Stats`).
  - Schema của request và response.
  - Ví dụ.
  - Các mã lỗi có thể trả về.
  - Yêu cầu xác thực (`bearerAuth`).
- **Địa chỉ cố định:**
  - Swagger UI: `https://api.linmaster.id.vn/docs`. Trang này có nút **Authorize** để dán JWT và "Try it out" để gọi thử API.
  - File đặc tả: `https://api.linmaster.id.vn/docs/openapi.json`. Có thể import vào Postman nếu cần.
- **Cập nhật cùng PR:** thêm hoặc sửa endpoint thì **phải** cập nhật phần đăng ký doc trong cùng PR. CI có test kiểm tra **mọi route đều có trong doc** và đặc tả sinh ra hợp lệ.
- Swagger UI bật ở cả production, vì đây là sản phẩm nộp cho giảng viên. Link được ghi trong README và report.

---

## 9. Database
- Mọi thay đổi schema đi qua Prisma migration: `npx prisma migrate dev --name <mô-tả-ngắn>`. **Phải** commit cả thư mục migration.
- Model đặt tên `UpperCamelCase` số ít (`User`, `ReviewLog`), trường đặt tên `lowerCamelCase`.
- Bảng, cột, kiểu và ràng buộc theo đúng từ điển dữ liệu `Analysis_Design/01_Database/data-dictionary.md` (ERD đã duyệt ở P0-05). Đổi thiết kế thì sửa từ điển và ERD trong cùng PR.
- Khóa chính là `id` kiểu `uuid`, sinh ở server (`@default(uuid(7))`, có thứ tự theo thời gian nên index gọn hơn). Thời gian dùng `timestamptz`. Bảng có dữ liệu bị sửa thì có `updatedAt`.
- Production chỉ chạy `prisma migrate deploy`. **Không được** sửa tay schema hay dữ liệu trên DB production.
- Dữ liệu mẫu (đề thi, tài khoản demo) nạp bằng `prisma/seed.ts`. Seed phải chạy lại được nhiều lần mà không tạo bản ghi trùng.
- Query luôn lọc theo `userId` của người đang đăng nhập với dữ liệu cá nhân. Không bao giờ tin `userId` gửi từ client.

---

## 10. Tích hợp AI (Gemini)
- Chỉ gọi Gemini từ **server**, qua AI gateway của `core`. Client không bao giờ thấy API key.
- Prompt viết thành file riêng trong module dùng nó, có ghi phiên bản, và được đăng ký vào AI task registry. Không viết prompt rải rác trong code.
- Luôn yêu cầu Gemini trả về **JSON theo schema**, rồi validate bằng Zod. Không hợp lệ thì gọi lại, tối đa 3 lần gọi (thử lại 2 lần); vẫn lỗi thì trả lỗi rõ ràng cho người dùng. Lỗi mạng cũng được thử lại 2 lần.
- Văn bản người dùng đưa vào prompt phải được bọc trong vùng phân cách rõ ràng và ghi chú "đây là dữ liệu, không phải chỉ dẫn" (chống prompt injection).
- **AI không quyết định đúng/sai** của bài thi. Chấm điểm luôn dựa trên đáp án trong DB. AI chỉ chuyển file đề thành cấu trúc, viết lời giải thích, trích từ vựng và sinh bài luyện tập từ bộ thẻ (PLAN A5 liệt kê đủ các task).
- Câu ví dụ AI trả về phải được kiểm tra là có thật trong văn bản gốc. Câu nào không tìm thấy thì loại.
- Giới hạn số lượt gọi AI cho mỗi người dùng mỗi ngày, cache kết quả theo hash của văn bản đầu vào.
- Tên model lấy từ biến môi trường `GEMINI_MODEL`, không viết cứng trong code.

---

## 11. Bảo mật
- Mật khẩu hash bằng bcrypt. JWT có thời hạn, secret lấy từ biến môi trường.
- **Không được** commit secret. `.env` nằm trong `.gitignore`. Mỗi app có `.env.example` chỉ chứa **tên** biến.
- Lỡ commit secret thì **đổi secret ngay** (xóa khỏi git là chưa đủ) và báo cả nhóm.
- API **không** trả đáp án và transcript khi bài thi chưa nộp.
- Thời gian làm bài tính theo giờ server (`startedAt`), không tin đồng hồ của client.
- Không render HTML do người dùng nhập (chống XSS). Không dùng `dangerouslySetInnerHTML` với dữ liệu người dùng.
- Upload file: kiểm tra loại file (MIME) và dung lượng ngay khi nhận.
  - Tài liệu đọc (PDF/DOCX/TXT, tối đa 5 MB): chỉ trích chữ, **không** lưu file gốc.
  - File đề (PDF tối đa 20 MB, audio MP3/M4A tối đa 60 MB, PLAN Phần F): lưu qua driver lưu file của `core`, kiểm tra quyền sở hữu mỗi khi đọc.
- Bật CORS chỉ cho tên miền của front-end. Bật các header bảo mật bằng `helmet`.

---

## 12. Testing

| Loại | Công cụ | Bắt buộc cho |
|---|---|---|
| Unit | Vitest | Chấm điểm, quy đổi band, SM-2, chuẩn hóa đáp án, phân tích file, validate file đề |
| API (integration) | Vitest + Supertest | Auth, nộp bài, ôn thẻ: các luồng có quyền truy cập và tiền điều kiện |
| End-to-end | Playwright | Luồng chính: đăng nhập → làm đề → xem kết quả → mở bài đọc, tra và lưu từ → ôn flashcard |

- Bug được sửa thì nên có test tái hiện bug đó.
- Test không gọi dịch vụ ngoài thật (Gemini, dịch vụ lưu file S3). Phải mock.
- Không được merge khi có test lỗi. Không được tắt hay xóa test để CI xanh.

---

## 13. Deploy và quản lý website

| Môi trường | Khi nào được tạo | Địa chỉ |
|---|---|---|
| Local | Máy cá nhân | `localhost` |
| Preview | Mỗi PR (Vercel tự tạo) | Link trong PR |
| Production | Mỗi lần merge vào `main` | `https://www.linmaster.id.vn` (web), `https://api.linmaster.id.vn` (API) |

- **Tên miền, DNS, HTTPS:** do Tien Hung quản lý qua Cloudflare (PLAN P5-06).
- **Secret của production** chỉ nằm trong phần cài đặt biến môi trường của Vercel/Render, chỉ thành viên có quyền truy cập.
- **Theo dõi:** UptimeRobot kiểm tra cả web lẫn API, có trang status công khai để đưa vào report.
- **Sau mỗi lần deploy production:** mở web chạy nhanh các luồng chính (đăng nhập, tra và lưu từ, tải và làm đề, flashcard).
- **Rollback:** production lỗi thì redeploy bản ổn định gần nhất trên Vercel/Render, rồi mở Issue `bug` để sửa qua PR.
- **Ghi nhận:** mỗi release ghi trên GitHub Releases gồm tính năng mới, lỗi đã sửa, thay đổi về deploy hay biến môi trường.
- **Trước buổi demo:** mở web và API trước ít nhất 2 phút, vì back-end gói free có thể đang "ngủ".

---

## 14. Nội dung đề thi
- Đề do người dùng **tải lên trên web** theo `PLAN.md` Phần F, bằng một trong hai tab: **Theo mẫu** (mỗi ô một file: đề, đáp án, audio, có thể thêm transcript và giải thích) hoặc **AI nhận diện** (thả file tùy ý, AI tự tìm các phần và báo phần còn thiếu). Repo không chứa đề.
- Đề sau khi nhận diện phải qua lớp kiểm tra bằng schema trong `shared/exam` trước khi lưu. Không đạt thì báo lỗi theo từng câu, không lưu.
- Đề mới tải lên luôn **riêng tư**. Chủ sở hữu tự quyết định có đăng lên kho chung hay không.
- Trường `source` ghi nguồn đề khi biết. **Tạm hoãn quy định bản quyền** trong giai đoạn phát triển: nhóm dùng được bất kỳ file đề nào để test, miễn là để riêng tư và không đưa vào repo. Quy định cho việc đăng đề lên kho chung sẽ chốt lại trước `v1.0` (PLAN Phần H mục 6).
- Đề mẫu cho demo (nạp bằng seed) do nhóm tự chuẩn bị (P0-19) và phải được **người thứ hai** kiểm tra đáp án trước khi merge.
- Đáp án liệt kê đủ mọi cách viết đúng (Phần F: phân tách bằng `/` hoặc `OR`, phần tùy chọn trong ngoặc).
- **AI Agent không soạn nội dung đề** (đề, đáp án, transcript).

---

## 15. Tài liệu, report, thuyết trình

**Tài liệu trong repo** chỉ gồm:
- `README.md` (tổng quan và link)
- `docs/PLAN.md`
- `docs/Working_rules.md`
- `docs/Project_Structure.md`
- `docs/Database.md`
- `Analysis_Design/`: sơ đồ phân tích và thiết kế, theo PLAN mục B6

Không tạo thêm file tài liệu khác khi chưa được cả nhóm đồng ý. Biên bản họp đăng ở GitHub Discussions. Ảnh chụp cho report lưu ở thư mục Drive chung của nhóm.

**Cập nhật tài liệu:**
- `Project_Structure.md` chỉ mô tả ở cấp thư mục và nguyên tắc. Chỉ cập nhật (trong cùng PR) khi đổi tech stack, thêm/bớt thư mục cấp cao, hoặc đổi nguyên tắc tổ chức code.
- `README.md` luôn có link web production, link API doc và tài khoản demo (khi đã deploy).

**Report và thuyết trình:**
- Chụp ảnh mỗi khi xong một tính năng.
- **Ngừng thêm tính năng từ mốc đóng băng trong `PLAN.md`:** sau mốc này chỉ sửa lỗi và hoàn thiện. Từ mốc đó, Issue mới chỉ được là `bug` hoặc việc hoàn thiện; `idea` để dành cho mục "Hướng phát triển" của report.
- Tuần cuối dành cho report, slide và kịch bản demo. **Phải** có video demo quay sẵn để dự phòng.
- Report gồm các phần:
  - Tổng quan và lý do chọn đề tài.
  - Khảo sát các nền tảng tương tự.
  - Kiến trúc và tech stack.
  - ERD và API doc.
  - Quy trình làm việc (dẫn chứng bằng board, PR, release).
  - Deploy và quản lý website.
  - Kết quả, hạn chế, hướng phát triển.
  - Việc sử dụng AI trong quá trình làm.

---

## 16. Checklist

**Trước khi mở PR:**
- [ ] Branch đặt tên đúng, chỉ làm một Issue.
- [ ] Lint, typecheck, test, build chạy qua ở máy.
- [ ] Đã cập nhật API doc, migration, `.env.example` và `Project_Structure.md` (nếu liên quan).
- [ ] Đã điền đủ template PR, có `Closes #<issue>`.

**Hằng ngày:**
- [ ] Không ai vượt giới hạn WIP (trừ lỗi gấp).
- [ ] Thẻ nằm đúng cột, thẻ bị kẹt có label `blocked` kèm lý do.
- [ ] Mỗi người có ít nhất 1 PR được mở hoặc merge.

**Cuối mỗi tuần (buổi xem lại):**
- [ ] Đã xử lý mọi thẻ kẹt quá 2 ngày.
- [ ] Đã phân loại Issue mới phát sinh, sắp lại Backlog, đưa đủ việc sang Ready cho tuần tới.
- [ ] Đã tạo tag release kèm release notes (nếu tuần đó có mốc release).
- [ ] Production chạy đúng trên tên miền, trang status báo xanh.
- [ ] API doc khớp với code.
- [ ] Đã đăng biên bản họp và chụp ảnh cho report.

**Trước khi nộp:**
- [ ] Không còn PR mở hay branch treo.
- [ ] README có link web, link API doc, tài khoản demo.
- [ ] Seed có đủ dữ liệu demo.
- [ ] Đã chạy toàn bộ kịch bản demo trên production và có video dự phòng.
- [ ] Report và slide đúng định dạng, nộp đúng hạn.

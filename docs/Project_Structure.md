# LinMaster — Project Structure

Tài liệu này mô tả **tech stack**, **kiến trúc** và **cấu trúc thư mục** của LinMaster ở mức tổng quan: mỗi phần dùng để làm gì và code mới nên đặt ở đâu.

> File này chỉ mô tả ở **cấp thư mục và nguyên tắc**, không liệt kê từng file. Thêm, đổi tên hay xóa file **không** cần sửa tài liệu này. Chỉ cập nhật khi thay đổi tech stack, thêm/bớt thư mục cấp cao, hoặc đổi nguyên tắc tổ chức code.

---

## 1. Kiến trúc tổng thể

```
                         ┌──────────────────────────────┐
  Trình duyệt ─────────▶ │  client  (Next.js, Vercel)   │  https://www.linmaster.id.vn
                         └──────────────┬───────────────┘
                                        │ REST / JSON + JWT
                                        ▼
                         ┌──────────────────────────────┐
                         │  server  (Express, Render)   │  https://api.linmaster.id.vn
                         └───┬──────────────┬───────────┘
                             │ Prisma       │ HTTPS
                             ▼              ▼
                   ┌──────────────┐  ┌──────────────┐
                   │ PostgreSQL   │  │ Gemini API   │
                   │ (Neon)       │  │ (Google)     │
                   └──────────────┘  └──────────────┘

  File tải lên (PDF đề, audio): Backblaze B2   DNS: iNET (OnePortal)
  Theo dõi: UptimeRobot                 CI: GitHub Actions
```

**Nguyên tắc:**
- Front-end và back-end **tách riêng**, chỉ giao tiếp qua REST API có tài liệu (OpenAPI). Mỗi phía deploy độc lập.
- **Logic quan trọng nằm ở server:** chấm điểm, tính giờ làm bài, lịch ôn SM-2, gọi AI. Client lo hiển thị và gửi thao tác của người dùng.
- Dự án là **monorepo dùng npm workspaces**: `client`, `server` và `shared` (phần dùng chung cho cả hai).
- Trong mỗi workspace, code **chia theo module** để các module phát triển song song mà không xung đột, và có thể gắn thêm module hay chức năng mới mà không sửa module cũ (mục 4.1).
- Đề thi **không nằm trong repo**: người dùng tải đề lên (PDF + audio) theo quy định ở PLAN Phần F, hệ thống tự nhận diện thành đề có cấu trúc.

---

## 2. Tech stack

### 2.1. Front-end

| Công nghệ | Vai trò | Lý do chọn |
|---|---|---|
| **Next.js** (App Router) + **TypeScript** | Framework React, routing theo thư mục, layout lồng nhau | Routing và layout có sẵn; deploy lên Vercel không cần cấu hình; dùng chung TypeScript với back-end |
| **Tailwind CSS** + **shadcn/ui** | Styling và thư viện component | Giao diện hiện đại, đồng nhất, có sẵn a11y; code component nằm trong repo nên sửa được |
| **Lucide**, font **Be Vietnam Pro** | Icon, font chữ | Đi kèm shadcn/ui; font hiển thị tiếng Việt đẹp |
| **next-intl** | Giao diện song ngữ Việt / Anh | Hợp với App Router; chuỗi của mỗi module nằm trong một namespace riêng |
| **SVG vẽ tay** | Biểu đồ dashboard | Biểu đồ đơn giản, không cần thêm thư viện |
| **React hooks** (`useState`, `useEffect`...) | Quản lý state (nhất là state phòng thi, nằm trong các hook của feature exam) | Đủ dùng, không thêm thư viện state riêng |

### 2.2. Back-end

| Công nghệ | Vai trò | Lý do chọn |
|---|---|---|
| **Node.js** (LTS) + **Express** + **TypeScript** | Web server, REST API | Đơn giản, phổ biến, cùng ngôn ngữ với front-end |
| **Zod** | Validate request, biến môi trường, output của AI | Một schema vừa kiểm tra lúc chạy vừa sinh kiểu TypeScript |
| **Prisma** | ORM, migration, seed | Schema dễ đọc, migration có lịch sử, sinh được ERD cho report |
| **JWT** + **bcrypt** | Xác thực, hash mật khẩu | Chuẩn phổ biến cho REST API |
| **Google Gen AI SDK** | Gọi Gemini | SDK chính thức |
| Thư viện đọc PDF/DOCX | Lấy chữ từ file tải lên | Xử lý ở server. Tài liệu đọc chỉ giữ phần chữ; file đề (PDF, audio) được lưu qua driver lưu file của `core` |
| **helmet**, **cors**, rate limit | Bảo mật tối thiểu | Theo Working_rules mục 11 |
| **Swagger UI** + **zod-to-openapi** | API doc tại `/docs`, đặc tả OpenAPI 3 sinh tự động từ Zod schema | Giảng viên yêu cầu Swagger; sinh từ code nên doc luôn khớp với API |

### 2.3. Dữ liệu và dịch vụ

| Thành phần | Dịch vụ |
|---|---|
| Database | PostgreSQL: chạy bằng Docker ở local, Neon khi deploy |
| File tải lên (PDF đề, PDF đáp án, audio) | Thư mục `uploads/` ở local (không commit), Backblaze B2 (qua S3 API) khi deploy. Đổi chỗ lưu chỉ là đổi driver (`local` / `s3`; `r2` là tên khác của driver `s3`) |
| AI | Google Gemini API (tên model cấu hình qua biến môi trường) |

### 2.4. Công cụ phát triển và vận hành

| Công cụ | Vai trò |
|---|---|
| npm workspaces | Quản lý monorepo |
| Docker Compose | Chạy PostgreSQL (`dev` và `test`) ở local |
| gts (ESLint + Prettier của Google) | Lint và định dạng theo Google TypeScript Style |
| Vitest, Supertest, Playwright | Unit test, API test, test end-to-end |
| GitHub Actions | CI trên mỗi PR |
| Vercel / Render | Deploy front-end (có preview cho từng PR) / back-end |
| iNET (OnePortal), UptimeRobot | DNS: CNAME `www` → Vercel, `api` → Render (HTTPS do Vercel và Render cấp) / theo dõi uptime |

Phiên bản cụ thể được khóa trong `package.json` và lockfile, không ghi ở đây.

---

## 3. Cấu trúc thư mục

```
linmaster/
├── .github/      Cấu hình CI và template cho Issue / Pull Request
├── client/       Front-end (Next.js)
├── server/       Back-end (Express) + database schema + API doc
├── shared/       Code dùng chung cho client và server
├── Analysis_Design/  Sơ đồ phân tích và thiết kế (PlantUML + ảnh PNG)
└── docs/         Tài liệu dự án
```

Code của client, server và shared đều **chia theo module**: `core` (nền tảng) và các module nghiệp vụ `auth`, `vocab`, `flashcard`, `exam`, `library`, `stats`. Riêng `home` (trang chủ ghép widget của các module) chỉ có ở client. Danh sách module, trách nhiệm và phụ thuộc giữa chúng xem [PLAN.md](PLAN.md) Phần B.

### `client/` — Front-end

| Thư mục | Ý nghĩa |
|---|---|
| `app/` | Các trang, tổ chức theo URL (quy ước App Router của Next.js). Trang được gom thành **4 nhóm layout**: `(public)` (landing, đăng nhập), `(app)` (có thanh điều hướng, cần đăng nhập), `(exam)` (phòng thi, toàn màn hình), `(study)` (chế độ học flashcard, toàn màn hình). File trang chỉ **ghép** component lấy từ `features/` |
| `features/` | **Mỗi module một thư mục**, chứa API, component, hook của module đó. Mỗi thư mục có một điểm export công khai duy nhất |
| `core/` | Khung ứng dụng: API client, phiên đăng nhập, navbar và nav registry, i18n (gồm nhãn từ vựng), landing, header bảo mật, tiện ích chung. Widget trang chủ nằm ở `features/home`, widget dashboard ở `features/stats` |
| `messages/` | Chuỗi giao diện `vi.json`, `en.json` (next-intl), mỗi module một namespace |
| `components/ui/` | Component nền do shadcn/ui sinh ra, dùng chung cho mọi module |
| `tests/` | Test end-to-end (Playwright). Unit test của client (Vitest) nằm cạnh file nguồn, tên `*.test.ts` |

### `server/` — Back-end

| Thư mục | Ý nghĩa |
|---|---|
| `src/core/` | Hạ tầng chung: cấu hình, DB client, lỗi, validate, bảo mật, JWT, AI gateway, Swagger registry, nạp module |
| `src/modules/` | **Mỗi module một thư mục**, chứa route, service, đăng ký Swagger, prompt AI (nếu có) và public API của module đó |
| `prisma/` | Schema database (`schema/<module>.prisma`, mỗi module một file, cùng `schema/schema.prisma` chứa generator và datasource), lịch sử migration, script seed (gồm dữ liệu mẫu cho demo) |
| `uploads/` | File tải lên khi chạy local (driver `local`), không commit |
| `tests/` | Unit test và API test, chia theo module |

**API doc (Swagger)** không có file viết tay. Mỗi endpoint đăng ký doc ngay cạnh route của nó, dùng lại chính Zod schema validate. Server sinh đặc tả OpenAPI lúc chạy và phục vụ:
- Swagger UI tại `/docs`.
- File đặc tả tại `/docs/openapi.json`.

Chi tiết luật xem [Working_rules.md](Working_rules.md) mục 8.4.

### `shared/` — Dùng chung

**Mỗi module một thư mục** (cộng thêm `core`), chứa Zod schema của request/response, kiểu dữ liệu, hằng số nghiệp vụ và các registry dùng ở cả hai phía (ví dụ cách chấm từng dạng câu hỏi). Viết một lần, client và server cùng dùng, nên hai phía không bị lệch nhau.

### `Analysis_Design/` — Sơ đồ thiết kế

ERD, use case, activity, sequence, state và kiến trúc (PLAN mục B6). Mỗi sơ đồ gồm file `.puml` (nguồn) và ảnh `.png` cùng tên, xuất bằng `render.sh`; riêng `07_Wireframe/` là prototype HTML. Mục lục ở `Analysis_Design/README.md`.

### `docs/` — Tài liệu

Gồm `PLAN.md`, `Working_rules.md`, `Project_Structure.md` và `Database.md`. Sơ đồ thiết kế nằm ở `Analysis_Design/`.

---

## 4. Nguyên tắc tổ chức code

### 4.1. Chia theo module
- Mỗi module nghiệp vụ là một **khối độc lập**, có mặt ở cả server, client và shared, luôn trong thư mục mang tên module.
- Module chỉ giao tiếp với module khác qua **public API** của module đó. **Không** import file nội bộ của module khác.
- Mỗi bảng trong database thuộc **đúng một module**. Chỉ module sở hữu được ghi vào bảng đó.
- Phụ thuộc giữa các module đi **một chiều, không có vòng**. Module ở dưới không biết module ở trên. Chiều phụ thuộc cụ thể xem PLAN.md mục B2.
- Ở client, feature không import feature khác. Liên kết giữa các trang dùng URL.
- **Thêm module mới** = tạo thư mục module ở server / client / shared + thêm schema của module + đăng ký **một dòng** vào module registry (server) và nav registry (client). Không sửa code của module khác.
- **Thêm chức năng vào module** ở những chỗ đã thiết kế dạng registry (dạng câu hỏi, nguồn tài liệu đọc, loại bài tập, widget…) = thêm một mục vào registry. Danh sách registry xem PLAN.md mục B4.

### 4.2. Bên trong một module server: 3 tầng

```
Request ─▶ middleware (core) ─▶ routes ─▶ service ─▶ hạ tầng (core: DB, AI)
```

| Tầng | Trách nhiệm | Không được làm |
|---|---|---|
| **middleware** (core) | Việc chung cho mọi request: xác thực, giới hạn tần suất, xử lý lỗi | Chứa logic nghiệp vụ |
| **routes** | Khai báo endpoint, validate input, đăng ký Swagger, gọi service, trả JSON | Chứa logic nghiệp vụ, truy cập DB trực tiếp |
| **service** | Logic nghiệp vụ: chấm điểm, SM-2, tra và lưu từ, thống kê | Đọc request/response, trả mã HTTP |
| **hạ tầng** (core) | Kết nối DB, gọi Gemini, định nghĩa lỗi | Chứa logic nghiệp vụ |

**Vì sao chia như vậy:** service không phụ thuộc HTTP nên dễ viết unit test và dễ tái sử dụng. Mỗi dịch vụ ngoài (DB, Gemini) chỉ được truy cập qua **một điểm** trong `core`, nên đổi cấu hình hay thêm retry/cache chỉ sửa một chỗ. Prompt AI tách thành file riêng có đánh phiên bản, đặt trong module dùng nó.

### 4.3. Front-end
- **Trang mỏng, feature dày:** trang chỉ ghép component và lấy dữ liệu, giao diện chi tiết nằm trong `features/`.
- **Một điểm gọi API:** mọi request tới back-end đi qua API client của `core`, nơi gắn JWT và xử lý lỗi.
- **State phòng thi** gom trong các hook của feature exam (`room-hooks`).
- **Phòng thi định danh theo lần làm bài (attempt)**, không theo đề. Nhờ vậy refresh không mất bài, đồng hồ tính theo giờ server, và kết quả có URL riêng.

### 4.4. Chung
- Kiểu dữ liệu và schema dùng ở cả hai phía đặt trong `shared/`, không định nghĩa lại ở từng phía.
- Cấu hình và secret lấy từ biến môi trường, được validate khi khởi động. Mỗi app có file `.env.example` liệt kê tên biến.
- Quy tắc đặt tên file và thư mục: xem [Working_rules.md](Working_rules.md) mục 7.

---

## 5. Thêm code mới: đặt ở đâu?

| Muốn làm | Đặt ở |
|---|---|
| Trang mới | `client/app/`, trong nhóm layout phù hợp; trang chỉ ghép component từ `features/` |
| Component, hook, hàm gọi API của một module | `client/features/<module>/` |
| Thành phần dùng chung toàn app (API client, phiên đăng nhập, i18n, landing, nav registry, header bảo mật, tiện ích). Layout nằm ở `client/app/` | `client/core/` |
| Endpoint mới | `server/src/modules/<module>/`: route + service + đăng ký Swagger; schema trong `shared/<module>`; có test |
| Bảng hoặc cột mới | File schema của module trong `server/prisma/schema/` + migration |
| Prompt AI mới | Trong module dùng prompt đó, đăng ký vào AI task registry của `core` |
| Module mới | Thư mục mới ở `server/src/modules/`, `client/features/`, `shared/` + đăng ký vào module registry và nav registry |
| Đề thi mới | Tải lên trên web theo PLAN Phần F. Đề mẫu cho demo nạp bằng script seed trong `server/prisma/` |
| Chuỗi giao diện mới | `client/messages/{vi,en}.json`, trong namespace của module |
| Biến môi trường mới | Phần validate env của app tương ứng + `.env.example` |

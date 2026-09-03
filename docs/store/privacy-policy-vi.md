# Chính sách quyền riêng tư — AI Translate

**Cập nhật lần cuối: 2026-09-03**

Đây là bản dịch tham khảo tiếng Việt của chính sách quyền riêng tư cho tiện ích mở rộng trình duyệt AI Translate. Bản tiếng Anh (`PRIVACY-POLICY.md`) là bản chính thức; nếu có mâu thuẫn, bản tiếng Anh sẽ được ưu tiên.

## Tiện ích này làm gì

AI Translate cho phép bạn chọn văn bản trên bất kỳ trang web nào để nhận bản dịch do AI tạo ra, cùng với bảng "Giải thích" tùy chọn (định nghĩa, ví dụ, ghi chú ngữ pháp) cho cụm từ đã chọn. Cả hai tính năng đều do người dùng chủ động kích hoạt — không có gì được dịch, giải thích hoặc gửi đi cho đến khi bạn chọn văn bản và nhấp vào biểu tượng dịch, mục menu chuột phải "Dịch văn bản đã chọn", hoặc nút Giải thích.

## Dữ liệu nào được xử lý, và gửi đến đâu

Dữ liệu duy nhất mà tiện ích này xử lý là:

- **Văn bản bạn chọn** trên trang, cộng với một đoạn trích ngắn xung quanh (tối đa khoảng 1.200 ký tự trong cùng đoạn văn) được dùng để làm cho bản dịch/giải thích chính xác hơn theo ngữ cảnh.
- **Ngôn ngữ đích của bạn**, và đối với Giải thích, một phỏng đoán cục bộ nhanh về ngôn ngữ nguồn (một phương pháp heuristic đơn giản dựa trên ký tự/chữ viết được sử dụng — dữ liệu này không bao giờ rời khỏi trình duyệt của bạn).

Dữ liệu này chỉ được gửi đến đúng một nơi: **công cụ dịch bạn đang sử dụng**, và chỉ vào thời điểm bạn yêu cầu dịch hoặc giải thích — không bao giờ tự động, không bao giờ chạy ngầm, và không bao giờ áp dụng cho văn bản bạn chưa chọn.

### Công cụ 1 — Cổng demo (mặc định, không cần thiết lập)

- Khi sử dụng cổng demo, văn bản và ngữ cảnh bạn chọn được gửi qua HTTPS đến cổng của nhà phát triển (`gpt.yapweijun1996.com/demo`) và được chuyển tiếp đến một dịch vụ AI thượng nguồn để tạo bản dịch hoặc phần giải thích.
- Dự án OpenAI hiện được cổng này sử dụng đã bật chia sẻ dữ liệu đầu vào và đầu ra với OpenAI. Vì vậy, nội dung gửi qua cổng demo có thể được chia sẻ với OpenAI và có thể được dùng để cải thiện hoặc huấn luyện các mô hình OpenAI. Điều này khác với chính sách mặc định của OpenAI API, theo đó dữ liệu API không được dùng để huấn luyện trừ khi khách hàng chủ động chọn tham gia. Vui lòng không gửi thông tin bí mật, thông tin cá nhân hoặc thông tin nhạy cảm mà bạn không muốn các dịch vụ này xử lý.
- Dịch vụ demo có thể chịu các giới hạn hằng ngày, giới hạn tốc độ hoặc giới hạn vận hành, và khả năng cung cấp có thể thay đổi. Nếu dịch vụ không khả dụng, tiện ích có thể cung cấp tùy chọn dùng khóa API riêng, dịch trên thiết bị nếu có, hoặc thử lại sau.

### Công cụ 2 — Trên thiết bị (riêng tư, không cần mạng)

- Sử dụng API Dịch và Phát hiện ngôn ngữ tích hợp sẵn của Chrome. Văn bản của bạn được xử lý hoàn toàn trên thiết bị của bạn — **không bao giờ được gửi qua mạng cho bất kỳ ai**, kể cả nhà phát triển.
- Đây là công cụ duy nhất mà tuyên bố "dữ liệu của bạn không bao giờ rời khỏi thiết bị" được áp dụng.
- Dịch trên thiết bị không thể hỗ trợ tính năng Giải thích (một hạn chế kỹ thuật của API trên thiết bị của Chrome), vì vậy Giải thích sẽ bị vô hiệu hóa khi đây là công cụ duy nhất khả dụng của bạn.

### Công cụ 3 — Dùng khóa API của riêng bạn (Gemini, OpenAI, hoặc DeepSeek)

- Nếu bạn thêm khóa API riêng cho Gemini, OpenAI, hoặc DeepSeek trong Cài đặt, văn bản và ngữ cảnh bạn chọn sẽ được gửi **trực tiếp từ trình duyệt của bạn đến API riêng của nhà cung cấp đó** (lần lượt là `generativelanguage.googleapis.com`, `api.openai.com`, hoặc `api.deepseek.com`), sử dụng khóa của riêng bạn.
- Nhà phát triển tiện ích này không bao giờ nhìn thấy lưu lượng này — dữ liệu đi thẳng từ trình duyệt của bạn đến nhà cung cấp bạn đã chọn. Dữ liệu của bạn tuân theo chính sách quyền riêng tư và cách lưu trữ dữ liệu riêng của nhà cung cấp đó, không phải của nhà phát triển. Hãy xem trực tiếp chính sách của nhà cung cấp nếu điều này quan trọng với bạn.
- Sau khi bạn thêm khóa cho một nhà cung cấp, cổng dùng thử miễn phí sẽ không còn được sử dụng nữa.

## Dữ liệu nào được lưu trữ, và ở đâu

| Dữ liệu | Ở đâu | Có được gửi đi đâu không? |
|---|---|---|
| (Các) khóa API của bạn, nếu có thêm | `chrome.storage.local` (chỉ trên trình duyệt của bạn) | Chỉ dưới dạng tiêu đề xác thực gửi đến API của nhà cung cấp cụ thể đó — không bao giờ gửi cho nhà phát triển, không bao giờ gửi đi bất kỳ đâu khác |
| Lựa chọn công cụ, ngôn ngữ đích của bạn | `chrome.storage.local` (chỉ cục bộ) | Không |
| Bộ nhớ đệm các bản dịch/giải thích gần đây (để tránh yêu cầu lại cùng một văn bản) | IndexedDB (chỉ trên trình duyệt của bạn) | Không — bộ nhớ đệm này không bao giờ rời khỏi thiết bị của bạn |

Dữ liệu được tiện ích này lưu trữ cục bộ không được đồng bộ hóa với máy chủ do nhà phát triển vận hành. Các thông tin về công cụ từ xa ở trên vẫn được áp dụng: nội dung đã chọn gửi đến cổng demo hoặc nhà cung cấp sẽ được xử lý theo chính sách của công cụ đó. Tiện ích không bán dữ liệu và không dùng dữ liệu cho quảng cáo.

## Những điều tiện ích này KHÔNG làm

- Không phân tích, đo từ xa, hoặc theo dõi việc sử dụng dưới bất kỳ hình thức nào.
- Không quảng cáo, và dữ liệu không bao giờ được bán hoặc chia sẻ với nhà quảng cáo.
- Không đọc thụ động nội dung trang — script nội dung chỉ hoạt động khi bạn thực hiện lựa chọn và nhấp vào một nút.
- Không cần tài khoản hoặc đăng nhập để sử dụng công cụ dùng thử miễn phí hoặc trên thiết bị.

## Tại sao tiện ích này có thể đọc dữ liệu trên tất cả các trang web

Chrome hiển thị cảnh báo khi cài đặt rằng tiện ích này có thể "đọc và thay đổi tất cả dữ liệu của bạn trên tất cả các trang web." Điều này là vì tiện ích cần phát hiện việc chọn văn bản trên **bất kỳ** trang nào bạn đang đọc, để biểu tượng dịch có thể xuất hiện bất kể bạn đang ở trang nào — nó không thể biết trước bạn sẽ muốn dịch trên trang nào. Trên thực tế, script nội dung chỉ đọc văn bản bạn chọn một cách rõ ràng; nó không quét, ghi lại, hoặc truyền đi bất kỳ nội dung nào khác trên trang.

## Quyền riêng tư của trẻ em

Tiện ích này không hướng đến trẻ em dưới 13 tuổi và không cố ý thu thập dữ liệu từ trẻ em (như đã mô tả ở trên, tiện ích không thu thập dữ liệu cá nhân của bất kỳ ai, bất kể độ tuổi).

## Thay đổi đối với chính sách này

Nếu chính sách này thay đổi theo cách ảnh hưởng đến dữ liệu nào được xử lý hoặc gửi đi đâu, ngày "Cập nhật lần cuối" ở trên sẽ thay đổi và, đối với các thay đổi quan trọng, một ghi chú sẽ được thêm vào trang niêm yết trên Chrome Web Store của tiện ích.

## Liên hệ

Mọi thắc mắc về chính sách này hoặc cách tiện ích xử lý dữ liệu: yapweijun1996@gmail.com

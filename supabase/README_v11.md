# v11 Android 카드 알림 자동 수집

1. Supabase SQL Editor에서 `migration_v11_card_imports.sql` 전체를 실행한다.
2. Supabase CLI로 프로젝트를 연결하고 함수를 배포한다.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy card-import --no-verify-jwt
```

3. 배포된 가계부의 `설정 → 카드 자동등록`에서 Android 연결키를 만든다.
4. MacroDroid의 카드 알림 매크로 동작을 `HTTP 요청`으로 바꾼다.
   - 메서드: `POST`
   - URL: 설정 화면에 표시되는 수신 주소
   - 헤더: `x-import-token` = 설정 화면에 한 번만 표시되는 연결키
   - 콘텐츠 유형: `application/json`
   - 본문: 알림 제목과 알림 텍스트를 각각 MacroDroid 매직 텍스트로 넣는다.

```json
{"title":"알림 제목 매직 텍스트","text":"알림 텍스트 매직 텍스트"}
```

연결키 원문은 DB에 저장하지 않으며, 잃어버리면 새 연결을 만들면 된다.

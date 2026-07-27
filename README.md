# 뉴에리두 전투 계산기

젠레스 존 제로의 강공, 명파, 이상 데미지를 계산하는 정적 웹 계산기입니다. 원본 Google 스프레드시트의 수식과 기본값을 JavaScript로 옮겼습니다.

## 웹에서 사용

<https://doubleo-zzz.github.io/zzz-damage-calculator/>

## 제공 기능

- 강공 데미지: 공격력, 방어·저항, 치명타, 피해증가, 그로기 배율
- 명파 데미지: 체력·공격력 기반 관입력과 관입피해, 치명타, 피해증가
- 이상 데미지:
  - 딜러 A/B 스냅샷 및 실시간 스탯
  - 속성이상, 혼돈, 난류 계수
  - 벨리나·프로미아·남궁우·아리아·그레이스·버니스·비비안 난개 배율
  - 레미엘 휘광 스킬 배율 및 전용 데미지
  - 두 조건 동시 비교
- 입력값 자동 저장 및 기본값 복원
- 모바일·데스크톱 반응형 UI

## 로컬 실행

빌드 과정이나 외부 패키지가 필요하지 않습니다. 정적 파일 서버로 프로젝트 루트를 열면 됩니다.

```bash
python -m http.server 4173
```

그다음 `http://localhost:4173`에 접속합니다.

## 테스트

```bash
npm test
npm run check
```

## 계산 기준

계산식과 기본값은 다음 공개 스프레드시트를 기준으로 합니다.

<https://docs.google.com/spreadsheets/d/1MBIJUZt4_295LxIxvePQEFrTjmFsOu0tKPb3oPK67Tg/htmlview>

소수점이 포함된 정밀 결과를 먼저 계산한 뒤, 원본 시트와 동일하게 최종 표기 데미지는 올림 처리합니다.

## 안내

이 프로젝트는 비공식 팬 제작 도구입니다. Zenless Zone Zero 및 관련 상표의 권리는 HoYoverse에 있습니다.

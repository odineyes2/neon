# 무료 에셋 킷 반입 매니페스트

이 세션(원격 컨테이너)은 조직 네트워크 정책상 코드 레지스트리(npm/pypi/crates/jsr)와
github.com 계열만 나갈 수 있고 kenney.nl·itch.io·polyhaven.com·ambientcg.com 같은
일반 웹사이트는 프록시에서 막힌다. 그래서 실제 zip 다운로드는 사용자가 로컬에서
받아 이 경로에 커밋해야 한다. 대신 로더 쪽은 이미 준비되어 있어서, **아래 경로에
파일만 채워 넣으면 코드를 다시 건드릴 필요 없이 그래픽에 반영된다** — 파일이
없으면 `assetLibrary.ts`가 조용히 지금의 단색 프리미티브로 폴백한다
(`src/render/assetLibrary.ts`, `src/render/assetManifest.ts`).

## 지금 바로 채워도 되는 것 (로더 연동 완료)

`src/render/props.ts`가 아래 4개 프롭에 대해 `public/assets/models/props/*.glb`를
비동기로 시도하고, 성공하면 지금의 단색 박스를 그 지오메트리로 교체한다(재질은
게임 쪽 코드가 계속 관리하므로 GLB의 머티리얼은 무시된다 — **지오메트리만
가져온다**). 경로·목표 크기의 단일 소스는 `src/render/assetManifest.ts`.

| 프롭 id | 저장 경로 | 목표 크기(가로×높이×깊이, 유닛) | 어디서 찾을지 | 무엇을 고를지 |
|---|---|---|---|---|
| `ac_unit` | `public/assets/models/props/ac_unit.glb` | 0.32 × 0.22 × 0.16 | [Kenney — City Kit (Industrial)](https://kenney.nl/assets/city-kit-industrial) 또는 [Factory Kit](https://kenney.nl/assets/factory-kit) | 벽걸이 에어컨 실외기. 팬 그릴이 붙은 사각 박스형 |
| `neon_sign` | `public/assets/models/props/neon_sign_frame.glb` | 0.55 × 0.28 × 0.05 | [Kenney — City Kit (Commercial)](https://kenney.nl/assets/city-kit-commercial) | 간판 프레임만(발광은 게임 재질이 담당하므로 발광 텍스처 없는 민짜 패널이면 충분) |
| `steam_vent` | `public/assets/models/props/steam_vent.glb` | 0.14 × 0.14 × 0.10 | [Kenney — Factory Kit](https://kenney.nl/assets/factory-kit) | 벽부착형 환기구/배기 그릴 |
| `exhaust_pipe` | `public/assets/models/props/exhaust_pipe.glb` | 0.10 × 0.60 × 0.10 | [Kenney — Factory Kit](https://kenney.nl/assets/factory-kit) 또는 [Quaternius — Sci-Fi Essentials Kit](https://quaternius.itch.io/sci-fi-essentials-kit) | 세로로 긴 원통/각관 배기 파이프 |

각 파일은 **단일 메시**로 내보낼 것(여러 메시가 있으면 첫 번째만 취한다).
원본 스케일·피벗은 신경 쓰지 않아도 된다 — `assetLibrary.ts`가 바운딩 박스를
계산해 원점 중심으로 옮기고 위 표의 목표 크기에 맞춰 자동으로 비균등 스케일한다.
다만 **정면이 로컬 +Z축**을 향하도록 모델링/익스포트해야 `placeOnFace`의
`lookAt` 배치가 바깥쪽을 보게 나온다.

## 표면 텍스처 (base 셸 재질)

`src/render/instancing.ts`가 카테고리별 재질에 `albedo`(색)·`normal`·`roughness`
맵을 비동기로 시도한다. **지오메트리는 바꾸지 않는다** — base 셸은 여전히
`BoxGeometry`이고, `placement.ts`의 레이캐스트가 축 정렬 면 법선을 가정하기
때문에(§아래 "왜 base/facade는 아직 연결하지 않았는가") 텍스처만 입힌다.

경로 규칙: `public/assets/textures/surface/<prefix>_{albedo,normal,roughness}.jpg`
(normal·roughness는 없어도 그만 — 없으면 그 맵 없이 렌더링된다)

| 카테고리 | prefix | 추천 텍스처 |
|---|---|---|
| residential | `container_rust` | 녹슨 골강판/컨테이너 외판 |
| commerce | `concrete_grime` | 때탄 콘크리트, 얼룩 |
| utility | `steel_panel` | 무광 스틸 패널 |
| access | `grate_metal` | 격자형 스틸(계단·통로) |
| civic | `concrete_clean` | 비교적 깨끗한 콘크리트 |
| lightwell | `concrete_clean` | civic과 동일 |

출처: [Poly Haven](https://polyhaven.com) 또는 [ambientCG](https://ambientcg.com)에서
"concrete", "rusted metal", "corrugated steel", "grate/mesh" 등으로 검색해 CC0
PBR 세트(2K면 충분, 4K는 낭비)를 받아 위 이름 규칙으로 리네임해서 넣으면 된다.

## 아직 로더에 연결하지 않은 것

다음은 게임 데이터(`src/data/blocks.json`)에 이미 식별자가 있지만, 이번 스코프에서는
연결하지 않았다. 파일을 넣어도 반영되지 않는다 — 별도 후속 작업이 필요하다.

- **base 셸 16종** (`concrete_shell`, `container_shell`, `steel_shell`, `cylinder_tank`,
  `elevator_shaft`, `reactor_core` 등): 지금 `instancing.ts`는 카테고리당 InstancedMesh
  하나에 공유 `BoxGeometry`를 쓰고, `placement.ts`의 레이캐스트가 "면 법선 = 축
  정렬" 가정으로 인접 셀 배치 좌표를 계산한다. 임의 형태의 GLB로 지오메트리를
  바꾸면 이 가정이 깨져 배치가 오동작할 수 있다. 안전하게 하려면 (a) 배치 판정용
  보이지 않는 박스 콜라이더와 (b) 눈에 보이는 GLB 비주얼을 분리하는 리팩터가
  선행되어야 한다.
- **facade 16종** (`shutter_front`, `barred_window`, `arcade_glass` 등): 면(face)마다
  다른 데칼/패널을 얹는 새 레이어라 지금 구조에 없다. props.ts와 비슷한 방식(면당
  1개, GLB 또는 평면+텍스처)으로 새로 만들어야 한다.
- **`laundry_line`, `pipe_bundle`**: 인접 셀 2개를 잇는 라인이라 "면 하나에 프롭
  하나" 모델(`placeOnFace`)로는 표현이 안 된다. 별도 배치 로직 필요.
- **`potted_plant`**: 외벽이 아니라 통로/계단 위에 놓이는 프롭이라 역시 다른
  배치 기준이 필요.

## 라이선스

Kenney·Quaternius 팩은 모두 CC0(퍼블릭 도메인급, 표기 의무 없음)이지만, 나중에
출처를 추적할 수 있도록 `public/assets/models/NOTES.md`, `public/assets/textures/NOTES.md`에
"파일명 — 팩 이름 — URL" 한 줄씩만 남겨두길 권한다.

## 왜 npm/GitHub로 직접 못 받았는가 (참고)

이 매니페스트를 준비하며 npm 레지스트리에서 Kenney/Quaternius 팩이 패키지로
올라와 있는지 확인했지만, 우리 테마에 맞는 CC0 팩은 없었다(핵사곤 타일 팩 하나만
발견). 다운로드를 대행한다는 서드파티 MCP 패키지(`arcane-assets-mcp`,
`threenative-asset-mcp`)도 있었으나 검증되지 않은 코드라 사용하지 않았다 — 어차피
같은 차단된 CDN을 다시 두드릴 뿐이라 실효성도 없다.

import * as THREE from 'three';

// 고전적인 three.js 그라디언트 스카이돔: 지평선(bottomColor)에서 천정(topColor)으로
// 세로 방향 보간. 씬 배경을 단색으로 칠하는 대신 실제 "하늘"처럼 보이게 한다.
const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
  }
`;

const SKY_RADIUS = 450;
const STAR_COUNT = 1200;
const STAR_RADIUS = 440;

export interface SkySystem {
  meshes: THREE.Object3D[];
  update(params: { topColor: THREE.Color; bottomColor: THREE.Color; starOpacity: number }): void;
}

export function createSkySystem(): SkySystem {
  const uniforms = {
    topColor: { value: new THREE.Color(0x000000) },
    bottomColor: { value: new THREE.Color(0x000000) },
    offset: { value: 15 },
    exponent: { value: 0.8 },
  };

  const skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 24, 16),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  skyMesh.renderOrder = -2;

  // 별: 하늘 위쪽 반구에만 흩뿌리고, 밤에만 서서히 드러난다.
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5; // 0(천정) ~ 90도(수평선)
    const y = Math.cos(phi) * STAR_RADIUS;
    const r = Math.sin(phi) * STAR_RADIUS;
    starPositions[i * 3] = Math.cos(theta) * r;
    starPositions[i * 3 + 1] = y;
    starPositions[i * 3 + 2] = Math.sin(theta) * r;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xe8f0ff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -1;

  function update({
    topColor,
    bottomColor,
    starOpacity,
  }: {
    topColor: THREE.Color;
    bottomColor: THREE.Color;
    starOpacity: number;
  }): void {
    uniforms.topColor.value.copy(topColor);
    uniforms.bottomColor.value.copy(bottomColor);
    starMaterial.opacity = starOpacity;
  }

  return { meshes: [skyMesh, stars], update };
}

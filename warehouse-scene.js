import * as THREE from './vendor/three.module.js';

const container = document.getElementById('warehouseIntroScene');
const intro = document.getElementById('warehouseIntro');
let renderer;
let scene;
let camera;
let frame = 0;
let target = window.warehouseTour?.progress || 0;
let current = target;
let failed = false;

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#102e3a');
  scene.fog = new THREE.Fog('#102e3a', 22, 69);
  camera = new THREE.PerspectiveCamera(63, 1, .1, 115);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  container.appendChild(renderer.domElement);

  const mat = (color, roughness = .82, metalness = .05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const concrete = mat('#aebbb6');
  const wall = mat('#365766');
  const wallDark = mat('#193b4a');
  const rackSteel = mat('#577481', .45, .65);
  const rackBeam = mat('#dcaa55', .55, .24);
  const palletWood = mat('#8e7857');
  const cartons = ['#d4bb86', '#bda46f', '#e1cb9a', '#80a99b', '#b3bbc0'].map(c => mat(c));
  const lineGold = mat('#e3c06e', .66, .12);
  const lanePale = mat('#d8dfd6', .68, .08);

  const cube = new THREE.BoxGeometry(1, 1, 1);
  const addBox = (x, y, z, w, h, d, material, parent = scene) => {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  };

  // Warehouse shell and central lane.
  addBox(0, -.23, -5, 21, .45, 74, concrete);
  addBox(-10.5, 4.2, -5, .35, 8.8, 74, wall);
  addBox(10.5, 4.2, -5, .35, 8.8, 74, wall);
  addBox(0, 8.55, -5, 21, .32, 74, wallDark);
  addBox(0, 4.2, -28, 21, 8.8, .35, wallDark);
  for (const x of [-3.1, 3.1]) addBox(x, .025, -5, .075, .025, 70, lineGold);
  for (let z = 23; z >= -27; z -= 5) {
    addBox(0, .035, z, 2.3, .025, .10, lanePale);
    addBox(-10.23, 3.5, z, .16, 7, .2, rackSteel);
    addBox(10.23, 3.5, z, .16, 7, .2, rackSteel);
  }
  for (let z = 22; z >= -28; z -= 7) {
    addBox(0, 8.15, z, 20.5, .18, .2, rackSteel);
    const fixture = addBox(0, 7.82, z, 4.5, .09, .42,
      new THREE.MeshStandardMaterial({ color: '#f9f2d6', emissive: '#f4e6b4', emissiveIntensity: 1.55 }));
    fixture.material.side = THREE.DoubleSide;
    const light = new THREE.PointLight('#fff1c7', 13, 19, 2);
    light.position.set(0, 7.4, z);
    scene.add(light);
  }

  // A pair of storage racks at each stop. Every load is an actual 3D pallet and cartons.
  const rackZ = [14, 8.5, 3, -2.5, -8, -13.5, -19];
  rackZ.forEach((z, row) => {
    for (const side of [-1, 1]) {
      const cx = side * 7.12;
      const rack = new THREE.Group();
      rack.position.set(cx, 0, z);
      scene.add(rack);
      for (const px of [-2.25, 2.25]) for (const pz of [-1.25, 1.25])
        addBox(px, 3.05, pz, .13, 6.1, .13, rackSteel, rack);
      for (const level of [.42, 2.13, 3.84, 5.55]) {
        for (const pz of [-1.27, 1.27]) addBox(0, level, pz, 4.7, .15, .17, rackBeam, rack);
        addBox(0, level - .05, 0, 4.48, .08, 2.45, rackSteel, rack);
      }
      for (let level = 0; level < 3; level++) {
        const baseY = .54 + level * 1.71;
        for (let col = 0; col < 3; col++) {
          const x = -1.43 + col * 1.43;
          addBox(x, baseY + .06, 0, 1.24, .12, 1.72, palletWood, rack);
          const material = cartons[(row * 3 + col + level + (side === 1 ? 2 : 0)) % cartons.length];
          const height = 1.03 + ((row + col + level) % 3) * .14;
          addBox(x, baseY + .14 + height / 2, 0, 1.15, height, 1.53, material, rack);
          // Carton seams emphasize scale as the camera moves past the shelves.
          addBox(x, baseY + .14 + height * .65, side * .79, 1.10, .025, .02, palletWood, rack);
        }
      }
      // Zone marker facing the aisle.
      const label = makeLabel(`ZONE ${String.fromCharCode(65 + row)}`);
      label.position.set(side * 5.65, 6.28, z);
      label.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(label);
    }
  });

  // Distant open dock frames and a small parked pallet truck.
  addBox(0, 4.35, -27.72, 7.2, 7.6, .15, rackSteel);
  addBox(0, 4.25, -27.45, 6.5, 7.15, .08,
    new THREE.MeshStandardMaterial({ color: '#71919a', emissive: '#8aaea7', emissiveIntensity: .48 }));
  for (const x of [-3.65, 3.65]) addBox(x, 4.2, -27.25, .2, 7.9, .25, rackBeam);
  addBox(0, 8.07, -27.25, 7.5, .22, .25, rackBeam);
  const truck = new THREE.Group();
  truck.position.set(3.9, 0, -16.5);
  scene.add(truck);
  addBox(0, .38, 0, 1.8, .75, 2.15, rackBeam, truck);
  addBox(0, 1.05, -.48, 1.28, .7, .9, rackSteel, truck);
  addBox(-.55, .13, 1.9, .18, .16, 3.1, rackSteel, truck);
  addBox(.55, .13, 1.9, .18, .16, 3.1, rackSteel, truck);

  scene.add(new THREE.HemisphereLight('#d9eff2', '#27414a', 2.8));
  const sun = new THREE.DirectionalLight('#ffebc3', 2.2);
  sun.position.set(-5, 12, 15);
  scene.add(sun);
  resize();
}

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e7d08c';
  ctx.fillRect(0, 0, 384, 112);
  ctx.fillStyle = '#183f51';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 192, 58);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.7, .78), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
}

function resize() {
  if (!renderer) return;
  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  frame = window.requestAnimationFrame(animate);
  if (intro.hidden) return;
  current += (target - current) * .07;
  const z = 22 - current * 41;
  camera.position.set(Math.sin(current * 5.8) * .33, 2.72 + Math.sin(current * 18) * .035, z);
  camera.lookAt(Math.sin(current * 4.5) * .25, 2.8, z - 16);
  renderer.render(scene, camera);
}

function open() {
  if (failed) return;
  if (!renderer) {
    try { buildScene(); }
    catch (error) {
      failed = true;
      console.warn('Warehouse 3D unavailable; showing the illustrated tour fallback.', error);
      return;
    }
  }
  resize();
  target = window.warehouseTour?.progress || 0;
  current = target;
  if (!frame) animate();
}

window.addEventListener('warehouse-tour-open', open);
window.addEventListener('warehouse-tour-progress', event => { target = event.detail.progress; });
window.addEventListener('warehouse-tour-close', () => {
  window.cancelAnimationFrame(frame);
  frame = 0;
});
window.addEventListener('resize', resize);
if (!intro.hidden) open();

<script>
  import { T, useThrelte, useTask } from '@threlte/core';
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

  const { renderer, scene, invalidate } = useThrelte();

  // --- Environment reflections from a real HDRI (the key premium ingredient) ---
  onMount(() => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new RGBELoader().load('/env.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
      invalidate();
    });
  });

  // --- Organic, hand-thrown-clay form: an icosphere with gentle noise ---
  function noise(x, y, z) {
    return (Math.sin(x * 1.7 + y * 0.9) + Math.sin(y * 1.9 + z * 1.1) + Math.sin(z * 1.6 + x * 0.7)) / 3;
  }
  const geometry = new THREE.IcosahedronGeometry(1.45, 48);
  {
    const p = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(1 + noise(v.x, v.y, v.z) * 0.035);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
  }

  // Glazed ceramic: clearcoat over a warm terracotta body → glossy env reflections.
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xbe5238,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.25,
  });
  const blob = new THREE.Mesh(geometry, material);

  // Soft grounded contact shadow (fake radial gradient — always soft, no shadow map).
  function shadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 122);
    grad.addColorStop(0, 'rgba(74,38,20,0.42)');
    grad.addColorStop(1, 'rgba(74,38,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 6.5),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.9 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -2.0;

  // --- Motion: idle float + cursor parallax (real 3D, honors reduced-motion) ---
  const reduce = typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tpx = 0, tpy = 0, px = 0, py = 0, t = 0;
  onMount(() => {
    const h = (e) => { tpx = e.clientX / window.innerWidth - 0.5; tpy = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener('pointermove', h);
    return () => window.removeEventListener('pointermove', h);
  });

  useTask((delta) => {
    if (reduce) return;
    t += delta;
    px += (tpx - px) * 0.05;
    py += (tpy - py) * 0.05;
    blob.rotation.y = t * 0.16 + px * 0.5;
    blob.rotation.x = -0.05 - py * 0.3 + Math.sin(t * 0.5) * 0.04;
    blob.position.y = Math.sin(t * 0.8) * 0.09;
    invalidate();
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 5.4]} fov={34} />
<T.AmbientLight intensity={0.35} />
<T.DirectionalLight position={[5, 7, 5]} intensity={1.4} color={0xfff0dc} />
<T.DirectionalLight position={[-6, 2, -4]} intensity={0.6} color={0xffcea6} />
<T is={blob} />
<T is={shadow} />

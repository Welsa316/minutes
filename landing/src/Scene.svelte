<script>
  import { T, useThrelte, useTask } from '@threlte/core';
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
  import gsap from 'gsap';
  import { hoveredCard } from './stores.js';

  const { renderer, scene, invalidate } = useThrelte();
  const reduce = typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Environment reflections from a real HDRI (the premium ingredient) ---
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

  // --- A rounded index-card slab (glazed ceramic) ---
  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const slabGeo = new THREE.ExtrudeGeometry(roundedRect(1.5, 1.04, 0.14), {
    depth: 0.08, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 4, curveSegments: 14,
  });
  slabGeo.center();

  const glaze = (hex, rough = 0.42) => new THREE.MeshPhysicalMaterial({
    color: hex, roughness: rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 1.2,
  });
  const mats = {
    cream: glaze(0xf1e7d6, 0.5),
    terra: glaze(0xc45537, 0.4),
    ink:   glaze(0x1c2839, 0.45),
    sand:  glaze(0xd9c9ad, 0.55),
  };
  const barGeo = new THREE.BoxGeometry(0.8, 0.09, 0.02);
  const lineGeo = new THREE.BoxGeometry(0.86, 0.045, 0.015);

  // Card layout — a loose fan facing the camera, one per feature chip.
  // order matches FEATURES: Meetings, Clients, Notes, Boards, To-dos
  const LAYOUT = [
    { mat: 'cream', pos: [ 0.15,  0.12,  0.65], rot: [-0.05, -0.12, -0.02], scale: 1.00, accent: true  },
    { mat: 'terra', pos: [-1.85,  0.98, -0.35], rot: [ 0.03,  0.30,  0.10], scale: 0.86, accent: false },
    { mat: 'cream', pos: [ 1.86,  0.52, -0.15], rot: [ 0.00, -0.32, -0.07], scale: 0.90, accent: true  },
    { mat: 'ink',   pos: [-1.28, -1.06,  0.12], rot: [ 0.05,  0.24, -0.05], scale: 0.84, accent: true  },
    { mat: 'sand',  pos: [ 1.42, -0.98, -0.5 ], rot: [-0.03, -0.26,  0.07], scale: 0.82, accent: false },
  ];

  const cards = [];        // { group, inner, base:{pos,rot,scale}, phase }
  const root = new THREE.Group();

  function buildCard(cfg, i) {
    const group = new THREE.Group();          // GSAP owns this (assemble + hover pop)
    const inner = new THREE.Group();          // idle bob lives here, never fights GSAP
    group.add(inner);

    const slab = new THREE.Mesh(slabGeo, mats[cfg.mat]);
    inner.add(slab);

    // A little "record" printed on the card: accent bar + a few ruled lines.
    const barColor = cfg.mat === 'terra' ? 0xf1e7d6 : 0xc45537;
    const bar = new THREE.Mesh(barGeo, new THREE.MeshPhysicalMaterial({ color: barColor, roughness: 0.35, clearcoat: 1, envMapIntensity: 1.1 }));
    bar.position.set(-0.28, 0.32, 0.055);
    inner.add(bar);
    const lineColor = cfg.mat === 'ink' ? 0x5b6b83 : 0x9c8f78;
    for (let k = 0; k < 3; k++) {
      const ln = new THREE.Mesh(lineGeo, new THREE.MeshStandardMaterial({ color: lineColor, roughness: 0.9 }));
      ln.position.set(0, 0.05 - k * 0.2, 0.055);
      ln.scale.x = k === 2 ? 0.6 : 1;
      inner.add(ln);
    }

    group.position.set(...cfg.pos);
    group.rotation.set(...cfg.rot);
    group.scale.setScalar(cfg.scale);
    root.add(group);
    cards.push({ group, inner, base: { pos: [...cfg.pos], rot: [...cfg.rot], scale: cfg.scale }, phase: i * 1.3 });
  }
  LAYOUT.forEach(buildCard);

  // --- Assemble-in: cards fly out from a collapsed, spun cluster at center ---
  onMount(() => {
    if (reduce) { invalidate(); return; }
    cards.forEach((c) => {
      c.group.position.set(c.base.pos[0] * 0.12, c.base.pos[1] * 0.12 - 0.2, c.base.pos[2] * 0.12);
      c.group.scale.setScalar(0.05);
      c.group.rotation.set(c.base.rot[0], c.base.rot[1] + 1.1, c.base.rot[2] + 0.5);
    });
    const tl = gsap.timeline({ delay: 0.15, onUpdate: invalidate });
    tl.to(cards.map((c) => c.group.position), {
      x: (i) => cards[i].base.pos[0], y: (i) => cards[i].base.pos[1], z: (i) => cards[i].base.pos[2],
      duration: 1.15, ease: 'expo.out', stagger: 0.09,
    }, 0);
    tl.to(cards.map((c) => c.group.scale), {
      x: (i) => cards[i].base.scale, y: (i) => cards[i].base.scale, z: (i) => cards[i].base.scale,
      duration: 1.1, ease: 'back.out(1.5)', stagger: 0.09,
    }, 0);
    tl.to(cards.map((c) => c.group.rotation), {
      x: (i) => cards[i].base.rot[0], y: (i) => cards[i].base.rot[1], z: (i) => cards[i].base.rot[2],
      duration: 1.2, ease: 'expo.out', stagger: 0.09,
    }, 0);
    return () => tl.kill();
  });

  // --- Chip → card link: pop the hovered card, recede the rest ---
  const unsub = hoveredCard.subscribe((idx) => {
    if (reduce || !cards.length) return;
    cards.forEach((c, i) => {
      const active = idx === i;
      const dim = idx != null && !active;
      gsap.to(c.group.position, { z: c.base.pos[2] + (active ? 0.85 : 0), duration: 0.55, ease: 'power3.out', onUpdate: invalidate });
      const s = c.base.scale * (active ? 1.16 : dim ? 0.93 : 1);
      gsap.to(c.group.scale, { x: s, y: s, z: s, duration: 0.55, ease: 'power3.out' });
    });
  });
  onDestroy(unsub);

  // --- Idle motion: group sway + cursor parallax + per-card bob ---
  let tpx = 0, tpy = 0, px = 0, py = 0, t = 0;
  onMount(() => {
    const h = (e) => { tpx = e.clientX / window.innerWidth - 0.5; tpy = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener('pointermove', h);
    return () => window.removeEventListener('pointermove', h);
  });

  useTask((delta) => {
    if (reduce) return;
    t += delta;
    px += (tpx - px) * 0.045;
    py += (tpy - py) * 0.045;
    root.rotation.y = Math.sin(t * 0.26) * 0.13 + px * 0.4;
    root.rotation.x = -0.02 + (-py) * 0.24 + Math.sin(t * 0.32) * 0.02;
    for (const c of cards) {
      c.inner.position.y = Math.sin(t * 0.7 + c.phase) * 0.055;
      c.inner.rotation.z = Math.sin(t * 0.5 + c.phase) * 0.02;
    }
    invalidate(); // keep the on-demand loop alive; reduced-motion returns above → static
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 6.1]} fov={34} />
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[5, 7, 5]} intensity={1.35} color={0xfff0dc} />
<T.DirectionalLight position={[-6, 2, -4]} intensity={0.55} color={0xffcea6} />
<T is={root} />

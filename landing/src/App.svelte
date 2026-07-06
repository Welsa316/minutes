<script>
  import * as THREE from 'three';
  import { Canvas } from '@threlte/core';
  import { onMount } from 'svelte';
  import Scene from './Scene.svelte';

  const REPO = 'Welsa316/minutes';
  let version = 'v0.1.1';
  let macHref = 'https://github.com/Welsa316/minutes/releases/download/v0.1.1/Minutes-0.1.1-arm64.dmg';
  let winHref = 'https://github.com/Welsa316/minutes/releases/download/v0.1.1/Minutes.Setup.0.1.1.exe';
  let isWin = false;

  onMount(async () => {
    isWin = /Windows/i.test(navigator.userAgent || '');
    try {
      const rel = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest').then((r) => (r.ok ? r.json() : null));
      if (rel && rel.assets) {
        const d = rel.assets.find((a) => /\.dmg$/i.test(a.name));
        const e = rel.assets.find((a) => /\.exe$/i.test(a.name));
        if (d) macHref = d.browser_download_url;
        if (e) winHref = e.browser_download_url;
        if (rel.tag_name) version = rel.tag_name;
      }
    } catch (e) { /* keep fallbacks */ }
  });
</script>

<div class="page">
  <header class="rise" style="animation-delay:.05s">
    <span class="mark">M</span><b>Minutes</b>
    <span class="sp"></span>
    <a href="https://github.com/Welsa316/minutes/releases" target="_blank" rel="noopener">Releases</a>
  </header>

  <main class="hero">
    <div class="lead">
      <p class="eyebrow rise" style="animation-delay:.12s">Native for Mac &amp; Windows</p>
      <h1 class="rise" style="animation-delay:.2s">Keep every<br>minute.</h1>
      <p class="lede rise" style="animation-delay:.3s">Meeting notes and a personal CRM — one quiet, fast desktop app.</p>

      <div class="cta rise" style="animation-delay:.4s">
        {#if isWin}
          <a class="btn primary" href={winHref}>
            <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/></svg>
            <span>Download for Windows</span>
          </a>
          <a class="btn ghost" href={macHref}>
            <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            <span>Download for Mac<span class="sub"> · Apple Silicon</span></span>
          </a>
        {:else}
          <a class="btn primary" href={macHref}>
            <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            <span>Download for Mac<span class="sub"> · Apple Silicon</span></span>
          </a>
          <a class="btn ghost" href={winHref}>
            <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/></svg>
            <span>Download for Windows</span>
          </a>
        {/if}
      </div>

      <p class="meta rise" style="animation-delay:.5s"><span>{version}</span><i class="sep"></i><a href="https://minutes-production.up.railway.app">Prefer the browser? Open the web app →</a></p>

      <div class="chips rise" style="animation-delay:.6s">
        <span><i></i>Meetings</span><span><i></i>Clients</span><span><i></i>Notes</span><span><i></i>Boards</span><span><i></i>To-dos</span>
      </div>
    </div>

    <div class="art">
      <Canvas
        rendererParameters={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        toneMapping={THREE.ACESFilmicToneMapping}
      >
        <Scene />
      </Canvas>
    </div>
  </main>

  <div class="tail rise" style="animation-delay:.7s">
    <details>
      <summary>First time opening it?</summary>
      <div class="hb">
        <p>These builds aren't signed with a paid developer certificate, so your OS shows a one-time prompt. Nothing is wrong with the app.</p>
        <p><strong>macOS</strong> — right-click the app → <strong>Open</strong> → <strong>Open</strong>. If it says "damaged", run this once in Terminal, then open normally:<br><code>xattr -cr /Applications/Minutes.app</code></p>
        <p><strong>Windows</strong> — on the SmartScreen prompt, click <strong>More info</strong> → <strong>Run anyway</strong>.</p>
      </div>
    </details>
    <footer>Personal build · <a href="https://github.com/Welsa316/minutes/releases" target="_blank" rel="noopener">All releases on GitHub</a></footer>
  </div>
</div>

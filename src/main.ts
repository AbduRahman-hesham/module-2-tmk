import * as THREE from 'three';
import './index.css';
import { DISTRICTS, GameState, HeroGender, LevelData, LevelOption, AnswerStatus, LEVELS } from './game/types.ts';
import { GameWorld } from './game/world.ts';
import { Hero } from './game/hero.ts';
import { GameCamera } from './game/camera.ts';
import { GameUI } from './game/ui.ts';
import { audio } from './game/audio.ts';

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function showWebGLError() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="fixed inset-0 flex items-center justify-center p-6 text-center bg-[#8be0ff]">
      <div class="bg-white p-8 rounded-3xl shadow-xl max-w-sm border-4 border-sky-400">
        <div class="text-6xl mb-4">😢</div>
        <div class="text-2xl font-bold text-slate-800">Your browser can't run this game</div>
      </div>
    </div>
  `;
}

class HappyCityGame {
  private renderer!: THREE.WebGLRenderer;
  private cameraCtrl!: GameCamera;
  private world!: GameWorld;
  private hero!: Hero;
  private ui!: GameUI;

  private clock: THREE.Clock = new THREE.Clock();
  private isPaused: boolean = false;
  private totalTime: number = 0;

  // State Machine: MENU → INTRO → CHOOSING → ANSWERED → END
  private state: GameState = 'MENU';
  private currentLevelIndex: number = 0;
  private answers: AnswerStatus[] = new Array(9).fill(null);
  private correctCount: number = 0;
  private currentShuffledOptions: LevelOption[] = [];

  // Timeout registry
  private activeTimeouts: number[] = [];

  constructor() {
    if (!checkWebGL()) {
      showWebGLError();
      return;
    }

    this.init();
  }

  private safeTimeout(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.activeTimeouts = this.activeTimeouts.filter((t) => t !== id);
      fn();
    }, ms);
    this.activeTimeouts.push(id);
    return id;
  }

  private clearAllTimeouts() {
    this.activeTimeouts.forEach((id) => clearTimeout(id));
    this.activeTimeouts = [];
  }

  private init() {
    const appEl = document.getElementById('app')!;
    appEl.innerHTML = '';

    // First user tap initializes Web Audio Context
    const handleFirstTap = () => {
      audio.init();
      window.removeEventListener('pointerdown', handleFirstTap);
      window.removeEventListener('keydown', handleFirstTap);
    };
    window.addEventListener('pointerdown', handleFirstTap);
    window.addEventListener('keydown', handleFirstTap);

    // Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'absolute inset-0 z-0';
    canvasContainer.appendChild(this.renderer.domElement);
    appEl.appendChild(canvasContainer);

    // Camera controller
    this.cameraCtrl = new GameCamera(window.innerWidth, window.innerHeight);

    // Procedural 3D World
    this.world = new GameWorld();

    // Hero
    this.hero = new Hero(this.world.islandGroup);
    this.hero.teleport([0, 0.4, 0]);

    // UI Overlay
    const uiContainer = document.createElement('div');
    uiContainer.className = 'absolute inset-0 z-10 pointer-events-none';
    appEl.appendChild(uiContainer);

    this.ui = new GameUI(uiContainer, {
      onPickHero: (gender: HeroGender) => this.startGame(gender),
      onSelectOption: (option: LevelOption, cardEl: HTMLElement) => this.handleOptionSelect(option, cardEl),
      onNext: () => this.handleNextLevel(),
      onPlayAgain: () => this.resetToMenu(),
    });

    // Window listeners
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      this.isPaused = document.visibilityState === 'hidden';
      if (!this.isPaused) {
        this.clock.getDelta();
      }
    });

    // Start in MENU state
    this.state = 'MENU';
    this.ui.showMenu();

    // Start render loop
    this.animate();
  }

  /**
   * Start game from hero picker
   */
  private startGame(gender: HeroGender) {
    this.clearAllTimeouts();
    this.hero.setHero(gender);

    this.currentLevelIndex = 0;
    this.answers = new Array(9).fill(null);
    this.correctCount = 0;

    this.world.resetAll();
    this.cameraCtrl.resetZoom();

    this.ui.showGame();
    this.startLevelIntro(this.currentLevelIndex);
  }

  /**
   * Level INTRO state: Camera + Hero move to district pad, question revealed
   */
  private startLevelIntro(levelIndex: number) {
    this.state = 'INTRO';
    this.ui.hideLevelContent();

    const level: LevelData = (LEVELS as unknown as LevelData[])[levelIndex];
    const district = DISTRICTS[levelIndex];

    // Shuffle cards once per level
    this.currentShuffledOptions = [...level.options].sort(() => Math.random() - 0.5);

    // Move camera & hero to current level's pad
    this.world.setActiveDistrict(district.id);
    this.cameraCtrl.flyToDistrict(district.id);
    this.hero.hopTo(district.heroSpot);

    // Prepare UI
    this.ui.prepareLevel(level, this.currentShuffledOptions, levelIndex, this.answers);

    // After 1.2s flight, reveal question & cards
    this.safeTimeout(() => {
      if (this.state !== 'INTRO') return;

      this.ui.revealLevelContent();
      this.state = 'CHOOSING';
    }, 1250);
  }

  /**
   * Card tap handler: 1 attempt per question
   */
  private handleOptionSelect(option: LevelOption, cardElement: HTMLElement) {
    // Spam protection: only accept input in CHOOSING state
    if (this.state !== 'CHOOSING') return;

    this.state = 'ANSWERED';
    audio.playTap();

    const district = DISTRICTS[this.currentLevelIndex];
    const isCorrect = option.isCorrect;

    // Record answer
    this.answers[this.currentLevelIndex] = isCorrect ? 'correct' : 'wrong';

    // Update UI cards & show tip + Next button
    this.ui.handleAnswerOutcome(cardElement, option);
    this.ui.updateProgressDots(this.currentLevelIndex, this.answers);

    if (isCorrect) {
      audio.playCorrect();
      this.hero.playHappy();
      this.correctCount++;

      // City reward: piece pops in on this pad
      this.world.rewardDistrict(district.id);

      // Sky brightens one step out of 9
      this.world.updateSkyMood(this.correctCount);

      // Camera zooms out slightly
      this.cameraCtrl.addZoomOut(0.035);
    } else {
      audio.playWrong();
      this.hero.playWrong();
      this.cameraCtrl.triggerShake(0.3, 0.18);
      // Pad stays empty!
    }
  }

  /**
   * Next button handler: No auto-advance, player taps when ready
   */
  private handleNextLevel() {
    if (this.state !== 'ANSWERED') return;

    if (this.currentLevelIndex < 8) {
      this.currentLevelIndex++;
      this.startLevelIntro(this.currentLevelIndex);
    } else {
      // Completed all 9 levels!
      this.state = 'END';
      this.cameraCtrl.pullBackForEnding();
      this.hero.hopTo([0, 0.35, 0]);
      this.safeTimeout(() => {
        this.hero.playSpinJump();
      }, 1200);

      this.world.particles.fireConfetti();
      this.world.particles.triggerFireworks();

      this.ui.showDoneScreen(this.answers);
    }
  }

  private resetToMenu() {
    this.clearAllTimeouts();
    this.state = 'MENU';
    this.currentLevelIndex = 0;
    this.answers = new Array(9).fill(null);
    this.correctCount = 0;

    this.world.resetAll();
    this.cameraCtrl.resetZoom();
    this.cameraCtrl.setMenuPose();
    this.hero.teleport([0, 0.4, 0]);

    this.ui.showMenu();
  }

  private onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.cameraCtrl.resize(width, height);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    if (this.isPaused) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.totalTime += dt;

    this.cameraCtrl.update(dt);
    this.world.update(this.totalTime, dt);
    this.hero.update(dt, this.cameraCtrl.camera);

    this.renderer.render(this.world.scene, this.cameraCtrl.camera);
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new HappyCityGame());
} else {
  new HappyCityGame();
}

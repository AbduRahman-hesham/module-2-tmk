import { HeroGender, LevelData, LevelOption, AnswerStatus } from './types.ts';
import { audio } from './audio.ts';

export interface UICallbacks {
  onPickHero: (gender: HeroGender) => void;
  onSelectOption: (option: LevelOption, cardElement: HTMLElement) => void;
  onNext: () => void;
  onPlayAgain: () => void;
}

export class GameUI {
  private container: HTMLElement;
  private callbacks: UICallbacks;

  // DOM Elements
  private menuOverlay!: HTMLElement;
  private hudOverlay!: HTMLElement;
  private progressDots: HTMLElement[] = [];
  private lessonBadge!: HTMLElement;
  private soundButton!: HTMLElement;

  // Question Cluster
  private questionCluster!: HTMLElement;
  private sceneEmojiEl!: HTMLElement;
  private questionTextEl!: HTMLElement;

  // Bottom Area: Cards + Tip + Next Button
  private bottomWrapper!: HTMLElement;
  private cardsContainer!: HTMLElement;
  private tipContainer!: HTMLElement;
  private tipTextEl!: HTMLElement;
  private nextButton!: HTMLElement;

  // End Screen
  private endOverlay!: HTMLElement;
  private endScoreEl!: HTMLElement;
  private endDotsContainer!: HTMLElement;

  // State
  private isLocked: boolean = false;
  private cardButtons: { btn: HTMLElement; option: LevelOption }[] = [];

  constructor(container: HTMLElement, callbacks: UICallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.render();
  }

  private render() {
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'absolute inset-0 pointer-events-none select-none flex flex-col justify-between safe-top safe-bottom safe-left safe-right p-3 md:p-6';

    // 1. Top HUD
    this.hudOverlay = document.createElement('div');
    this.hudOverlay.className = 'flex items-center justify-between w-full max-w-2xl mx-auto transition-opacity duration-300 opacity-0 pointer-events-auto';

    // 9 Progress dots
    const dotsCluster = document.createElement('div');
    dotsCluster.className = 'flex items-center gap-1.5 md:gap-2 bg-white/95 px-3.5 py-2 md:px-5 md:py-2.5 rounded-full shadow-lg border-4 border-sky-300';

    this.progressDots = [];
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement('div');
      dot.className = 'w-4 h-4 md:w-5 md:h-5 rounded-full bg-slate-200 border-2 border-slate-300 transition-all';
      dotsCluster.appendChild(dot);
      this.progressDots.push(dot);
    }
    this.hudOverlay.appendChild(dotsCluster);

    // Lesson badge: "Lesson N · Name"
    this.lessonBadge = document.createElement('div');
    this.lessonBadge.className = 'flex items-center gap-2 bg-white/95 px-4 py-2 md:px-5 md:py-2.5 rounded-full shadow-lg border-4 border-amber-300 font-bold text-sm md:text-lg text-slate-800';
    this.lessonBadge.textContent = 'Lesson 1 · GDP';
    this.hudOverlay.appendChild(this.lessonBadge);

    // Mute button
    this.soundButton = document.createElement('button');
    this.soundButton.className = 'kid-btn w-10 h-10 md:w-12 md:h-12 rounded-full bg-white shadow-lg border-4 border-sky-400 flex items-center justify-center text-lg md:text-xl active:scale-90';
    this.soundButton.setAttribute('aria-label', 'Toggle Sound');
    this.soundButton.textContent = '🔊';
    this.soundButton.addEventListener('click', () => {
      const muted = audio.toggleMute();
      this.soundButton.textContent = muted ? '🔇' : '🔊';
    });
    this.hudOverlay.appendChild(this.soundButton);

    root.appendChild(this.hudOverlay);

    // 2. Middle Question Cluster: Scene Emojis + Question (max 10 words)
    this.questionCluster = document.createElement('div');
    this.questionCluster.className = 'flex flex-col items-center gap-1.5 md:gap-2.5 w-full max-w-lg mx-auto pointer-events-none mt-1 transition-opacity duration-300 opacity-0';

    // Scene emojis
    this.sceneEmojiEl = document.createElement('div');
    this.sceneEmojiEl.className = 'text-3xl md:text-5xl tracking-widest filter drop-shadow-md py-1 animate-gentle-float pointer-events-auto';
    this.sceneEmojiEl.textContent = '🏭🍞🚗';
    this.questionCluster.appendChild(this.sceneEmojiEl);

    // Question bubble
    const qBubble = document.createElement('div');
    qBubble.className = 'bg-white/95 px-5 py-2.5 md:px-7 md:py-3.5 rounded-[28px] shadow-xl border-4 border-amber-400 text-center pointer-events-auto max-w-md';

    this.questionTextEl = document.createElement('div');
    this.questionTextEl.className = 'font-bold text-lg md:text-2xl text-slate-800 leading-snug';
    this.questionTextEl.textContent = 'Everything a country makes in a year?';
    qBubble.appendChild(this.questionTextEl);

    this.questionCluster.appendChild(qBubble);
    root.appendChild(this.questionCluster);

    // 3. Bottom Area: 3 Picture Cards + Tip + Big "Next ▶" Button
    this.bottomWrapper = document.createElement('div');
    this.bottomWrapper.className = 'w-full max-w-xl mx-auto pb-2 md:pb-4 flex flex-col gap-2.5 transition-all duration-300 opacity-0 pointer-events-auto';

    // 3 Picture Cards
    this.cardsContainer = document.createElement('div');
    this.cardsContainer.className = 'grid grid-cols-3 gap-2.5 md:gap-4 w-full';
    this.bottomWrapper.appendChild(this.cardsContainer);

    // Tip & Next Container (hidden until answered)
    this.tipContainer = document.createElement('div');
    this.tipContainer.className = 'flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white/95 p-3 md:p-4 rounded-3xl shadow-xl border-4 border-sky-400 transition-all duration-300 hidden';

    this.tipTextEl = document.createElement('div');
    this.tipTextEl.className = 'font-bold text-sm md:text-base text-slate-700 leading-tight text-center sm:text-left flex-1 px-1';
    this.tipTextEl.textContent = '💡 Tip here';
    this.tipContainer.appendChild(this.tipTextEl);

    // Big Next ▶ button (min 80px wide / touch-friendly)
    this.nextButton = document.createElement('button');
    this.nextButton.className = 'kid-btn min-h-[56px] md:min-h-[64px] px-6 md:px-8 bg-gradient-to-r from-emerald-400 to-green-500 text-white font-black text-xl md:text-2xl rounded-2xl shadow-lg border-2 border-white flex items-center justify-center gap-2 active:scale-95 shrink-0 w-full sm:w-auto';
    this.nextButton.innerHTML = '<span>Next</span> <span>▶</span>';
    this.nextButton.addEventListener('click', () => {
      audio.playTap();
      this.callbacks.onNext();
    });
    this.tipContainer.appendChild(this.nextButton);

    this.bottomWrapper.appendChild(this.tipContainer);
    root.appendChild(this.bottomWrapper);

    // 4. Menu Overlay ("Pick your hero!")
    this.menuOverlay = document.createElement('div');
    this.menuOverlay.className = 'absolute inset-0 flex flex-col items-center justify-center p-4 bg-sky-900/20 pointer-events-auto transition-opacity duration-300';

    const menuBox = document.createElement('div');
    menuBox.className = 'bg-white/95 rounded-[36px] shadow-2xl p-6 md:p-8 max-w-lg w-full text-center border-6 border-sky-400 flex flex-col items-center animate-gentle-float';

    const gameTitle = document.createElement('h1');
    gameTitle.className = 'text-3xl md:text-5xl font-extrabold text-sky-600 mb-1 tracking-tight drop-shadow-sm flex items-center gap-2 justify-center';
    gameTitle.innerHTML = '🌟 Happy City';
    menuBox.appendChild(gameTitle);

    const menuPrompt = document.createElement('h2');
    menuPrompt.className = 'text-2xl md:text-3xl font-bold text-slate-800 mb-6';
    menuPrompt.textContent = 'Pick your hero!';
    menuBox.appendChild(menuPrompt);

    const heroCardsContainer = document.createElement('div');
    heroCardsContainer.className = 'grid grid-cols-2 gap-4 md:gap-6 w-full';

    const boyCard = this.createHeroCard('boy', 'Boy', '👦', '#38bdf8');
    boyCard.addEventListener('click', () => {
      audio.playTap();
      this.callbacks.onPickHero('boy');
    });
    heroCardsContainer.appendChild(boyCard);

    const girlCard = this.createHeroCard('girl', 'Girl', '👧', '#f472b6');
    girlCard.addEventListener('click', () => {
      audio.playTap();
      this.callbacks.onPickHero('girl');
    });
    heroCardsContainer.appendChild(girlCard);

    menuBox.appendChild(heroCardsContainer);
    this.menuOverlay.appendChild(menuBox);
    root.appendChild(this.menuOverlay);

    // 5. Done / End Screen
    this.endOverlay = document.createElement('div');
    this.endOverlay.className = 'absolute inset-0 flex flex-col items-center justify-center p-4 bg-sky-900/30 pointer-events-auto hidden transition-opacity duration-500';

    const endBox = document.createElement('div');
    endBox.className = 'bg-white/95 rounded-[40px] shadow-2xl p-6 md:p-8 max-w-md w-full text-center border-8 border-amber-400 flex flex-col items-center pop-bounce';

    const trophyIcon = document.createElement('div');
    trophyIcon.className = 'text-6xl md:text-7xl mb-1';
    trophyIcon.textContent = '🏆';
    endBox.appendChild(trophyIcon);

    const doneTitle = document.createElement('h2');
    doneTitle.className = 'text-3xl md:text-4xl font-black text-amber-500 mb-1 tracking-tight';
    doneTitle.textContent = 'Done!';
    endBox.appendChild(doneTitle);

    this.endScoreEl = document.createElement('div');
    this.endScoreEl.className = 'text-lg md:text-xl font-bold text-slate-600 mb-4';
    this.endScoreEl.textContent = 'You completed all 9 lessons!';
    endBox.appendChild(this.endScoreEl);

    this.endDotsContainer = document.createElement('div');
    this.endDotsContainer.className = 'flex gap-2 justify-center mb-6';
    endBox.appendChild(this.endDotsContainer);

    const playAgainBtn = document.createElement('button');
    playAgainBtn.className = 'kid-btn w-full min-h-[80px] bg-gradient-to-r from-emerald-400 to-green-500 text-white font-black text-2xl md:text-3xl rounded-3xl shadow-xl border-4 border-white flex items-center justify-center gap-3 active:scale-95';
    playAgainBtn.innerHTML = '<span>🔄</span> <span>Play again</span>';
    playAgainBtn.addEventListener('click', () => {
      audio.playTap();
      this.callbacks.onPlayAgain();
    });
    endBox.appendChild(playAgainBtn);

    this.endOverlay.appendChild(endBox);
    root.appendChild(this.endOverlay);

    this.container.appendChild(root);
  }

  private createHeroCard(gender: HeroGender, label: string, emoji: string, accentColor: string): HTMLElement {
    const card = document.createElement('button');
    card.className = 'kid-btn flex flex-col items-center justify-center p-4 rounded-3xl bg-slate-50 border-4 shadow-xl min-h-[140px] md:min-h-[180px] hover:bg-white active:scale-95 transition-all';
    card.style.borderColor = accentColor;

    const imgWrap = document.createElement('div');
    imgWrap.className = 'w-24 h-24 md:w-32 md:h-32 mb-2 flex items-center justify-center overflow-hidden rounded-2xl';

    const img = document.createElement('img');
    img.src = `/characters/${gender}.png`;
    img.alt = label;
    img.className = 'w-full h-full object-contain';
    img.onerror = () => {
      img.style.display = 'none';
      imgWrap.innerHTML = `<span class="text-6xl">${emoji}</span>`;
    };
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

    const nameBadge = document.createElement('div');
    nameBadge.className = 'font-bold text-xl md:text-2xl text-slate-800 flex items-center gap-1';
    nameBadge.textContent = `${emoji} ${label}`;
    card.appendChild(nameBadge);

    return card;
  }

  public showMenu() {
    this.menuOverlay.classList.remove('hidden');
    this.menuOverlay.style.opacity = '1';
    this.hudOverlay.style.opacity = '0';
    this.questionCluster.style.opacity = '0';
    this.bottomWrapper.style.opacity = '0';
    this.endOverlay.classList.add('hidden');
    this.endOverlay.style.opacity = '0';
  }

  public showGame() {
    this.menuOverlay.style.opacity = '0';
    setTimeout(() => {
      this.menuOverlay.classList.add('hidden');
    }, 300);

    this.hudOverlay.style.opacity = '1';
    this.endOverlay.classList.add('hidden');
  }

  /**
   * Update 9 progress dots
   */
  public updateProgressDots(currentIndex: number, answers: AnswerStatus[]) {
    this.progressDots.forEach((dot, idx) => {
      const status = answers[idx];
      if (status === 'correct') {
        dot.className = 'w-3.5 h-3.5 md:w-4.5 md:h-4.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm';
      } else if (status === 'wrong') {
        dot.className = 'w-3.5 h-3.5 md:w-4.5 md:h-4.5 rounded-full bg-rose-500 border-2 border-white shadow-sm';
      } else if (idx === currentIndex) {
        dot.className = 'w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-400 border-2 border-white scale-125 shadow-md animate-pulse';
      } else {
        dot.className = 'w-3.5 h-3.5 md:w-4.5 md:h-4.5 rounded-full bg-slate-200 border-2 border-slate-300';
      }
    });
  }

  /**
   * Prepare a level: scene emojis, question, shuffled cards
   */
  public prepareLevel(level: LevelData, shuffledOptions: LevelOption[], currentIndex: number, answers: AnswerStatus[]) {
    this.isLocked = true;

    // Badge: "Lesson N · Name"
    this.lessonBadge.textContent = `Lesson ${level.lessonNumber} · ${level.lessonName}`;

    // Update dots
    this.updateProgressDots(currentIndex, answers);

    // Scene emojis & question
    this.sceneEmojiEl.textContent = level.scene;
    this.questionTextEl.textContent = level.question;

    // Tip text
    this.tipTextEl.textContent = `💡 ${level.tip}`;
    this.tipContainer.classList.add('hidden');

    // 3 Picture Cards
    this.cardsContainer.innerHTML = '';
    this.cardButtons = [];

    const defaultColors = [
      'bg-amber-400 border-amber-500',
      'bg-sky-400 border-sky-500',
      'bg-indigo-400 border-indigo-500',
    ];

    shuffledOptions.forEach((opt, idx) => {
      const card = document.createElement('button');
      // emoji ~64px (text-5xl/text-6xl) + label max 5 words
      card.className = `kid-btn min-h-[110px] md:min-h-[135px] w-full rounded-3xl ${defaultColors[idx % 3]} border-4 text-white font-black text-lg md:text-xl shadow-xl flex flex-col items-center justify-center p-2.5 active:scale-95 relative overflow-hidden card-slide-up`;
      card.style.animationDelay = `${idx * 80}ms`;

      card.innerHTML = `
        <span class="text-5xl md:text-6xl mb-1">${opt.emoji}</span>
        <span class="leading-tight text-center drop-shadow-sm px-1">${opt.text}</span>
      `;

      card.addEventListener('click', () => {
        if (this.isLocked) return;
        this.callbacks.onSelectOption(opt, card);
      });

      this.cardsContainer.appendChild(card);
      this.cardButtons.push({ btn: card, option: opt });
    });
  }

  public revealLevelContent() {
    this.questionCluster.style.opacity = '1';
    this.bottomWrapper.style.opacity = '1';
    this.isLocked = false;
  }

  public hideLevelContent() {
    this.questionCluster.style.opacity = '0';
    this.bottomWrapper.style.opacity = '0';
  }

  /**
   * Tap a card → lock all cards → chosen card turns green ✔ (correct) or red ✖ (wrong).
   * If wrong, the correct card also turns green ✔.
   * Show tip + Next button.
   */
  public handleAnswerOutcome(chosenCard: HTMLElement, chosenOption: LevelOption) {
    this.isLocked = true;

    // Lock all card clicks
    this.cardButtons.forEach((c) => {
      (c.btn as HTMLButtonElement).disabled = true;
    });

    if (chosenOption.isCorrect) {
      // Chosen card turns green ✔
      chosenCard.className = 'kid-btn min-h-[110px] md:min-h-[135px] w-full rounded-3xl bg-emerald-500 border-4 border-emerald-600 text-white font-black text-lg md:text-xl shadow-xl flex flex-col items-center justify-center p-2.5 relative overflow-hidden card-correct-glow';
      const badge = document.createElement('div');
      badge.className = 'absolute top-2 right-2 w-8 h-8 rounded-full bg-white text-emerald-600 font-black flex items-center justify-center text-xl shadow-md';
      badge.textContent = '✔';
      chosenCard.appendChild(badge);
    } else {
      // Chosen card turns red ✖
      chosenCard.className = 'kid-btn min-h-[110px] md:min-h-[135px] w-full rounded-3xl bg-rose-500 border-4 border-rose-600 text-white font-black text-lg md:text-xl shadow-xl flex flex-col items-center justify-center p-2.5 relative overflow-hidden card-shake';
      const badge = document.createElement('div');
      badge.className = 'absolute top-2 right-2 w-8 h-8 rounded-full bg-white text-rose-600 font-black flex items-center justify-center text-xl shadow-md';
      badge.textContent = '✖';
      chosenCard.appendChild(badge);

      // Correct card ALSO turns green ✔
      const correctEntry = this.cardButtons.find((c) => c.option.isCorrect);
      if (correctEntry) {
        correctEntry.btn.className = 'kid-btn min-h-[110px] md:min-h-[135px] w-full rounded-3xl bg-emerald-500 border-4 border-emerald-600 text-white font-black text-lg md:text-xl shadow-xl flex flex-col items-center justify-center p-2.5 relative overflow-hidden';
        const cBadge = document.createElement('div');
        cBadge.className = 'absolute top-2 right-2 w-8 h-8 rounded-full bg-white text-emerald-600 font-black flex items-center justify-center text-xl shadow-md';
        cBadge.textContent = '✔';
        correctEntry.btn.appendChild(cBadge);
      }
    }

    // Show tip + Next button
    this.tipContainer.classList.remove('hidden');
  }

  public showDoneScreen(answers: AnswerStatus[]) {
    this.hideLevelContent();

    const correctCount = answers.filter((a) => a === 'correct').length;
    this.endScoreEl.textContent = `You got ${correctCount} of 9 right! 🌟`;

    this.endDotsContainer.innerHTML = '';
    answers.forEach((status) => {
      const dot = document.createElement('div');
      if (status === 'correct') {
        dot.className = 'w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold';
        dot.textContent = '✔';
      } else {
        dot.className = 'w-6 h-6 rounded-full bg-rose-500 border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold';
        dot.textContent = '✖';
      }
      this.endDotsContainer.appendChild(dot);
    });

    this.endOverlay.classList.remove('hidden');
    setTimeout(() => {
      this.endOverlay.style.opacity = '1';
    }, 10);

    audio.playFinalMelody();
  }
}

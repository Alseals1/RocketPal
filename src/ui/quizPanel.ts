import type { Speaker } from '../audio/speech';
import { createQuizRun, type QuizQuestion, type QuizRun } from '../quiz/quiz';
import { keepTabInside } from './focus';
import { MAX_STARS, setStars } from './stars';

export interface QuizPanelCallbacks {
  /** The quiz was finished. Saves the result and returns how many stars the kid now has on this world. */
  onFinished(perfect: boolean): number;
  onBackToSpace(): void;
  /** The panel was closed by the kid (Not now, Keep exploring, Escape). Not called when the screen closes it. */
  onClosed(): void;
}

/** The quiz card: three questions, tries as often as you like, then the stars. It looks and behaves like the fact card. */
export class QuizPanel {
  private readonly overlay: HTMLElement;
  private readonly els: Record<string, HTMLElement> = {};
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private run: QuizRun | null = null;
  private optionButtons: HTMLButtonElement[] = [];
  private answered = false;
  /** What Listen reads right now. */
  private spoken = '';

  constructor(
    parent: HTMLElement,
    private readonly questions: QuizQuestion[],
    private readonly teaser: string,
    private readonly speaker: Speaker,
    private readonly callbacks: QuizPanelCallbacks,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fact-overlay quiz-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <div class="card fact-card quiz-card" role="dialog" aria-modal="true" aria-labelledby="quiz-heading" data-testid="quiz-card">
        <p class="quiz-step" data-el="step" data-testid="quiz-step"></p>
        <h2 id="quiz-heading" data-el="heading" data-testid="quiz-question" tabindex="-1"></h2>
        <p class="quiz-stars" data-el="stars" data-testid="quiz-stars" hidden></p>
        <div class="quiz-options" data-el="options" role="group" aria-label="Answers"></div>
        <p class="quiz-feedback" data-el="feedback" data-testid="quiz-feedback" role="status" aria-live="polite"></p>
        <p class="fact-text quiz-because" data-el="because" data-testid="quiz-because" hidden></p>
        <p class="fact-source quiz-teaser" data-el="teaser" data-testid="quiz-teaser" hidden></p>
        <div class="fact-actions" data-el="actions">
          <button class="big-button" type="button" data-el="listen" data-testid="quiz-listen"></button>
          <button class="big-button" type="button" data-el="next" data-testid="quiz-next" hidden></button>
          <button class="big-button" type="button" data-el="again" data-testid="quiz-again" hidden>Play again</button>
          <button class="big-button secondary" type="button" data-el="close" data-testid="quiz-close">Not now</button>
          <button class="big-button secondary" type="button" data-el="back" data-testid="quiz-back" hidden>Back to space</button>
        </div>
      </div>`;
    parent.appendChild(this.overlay);
    this.overlay.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => (this.els[el.dataset.el!] = el));

    this.els.listen.addEventListener('click', () => this.toggleListening());
    this.els.next.addEventListener('click', () => this.next());
    this.els.again.addEventListener('click', () => this.open());
    this.els.close.addEventListener('click', () => this.closeByKid());
    this.els.back.addEventListener('click', () => {
      this.close();
      this.callbacks.onBackToSpace();
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.closeByKid();
    });
    this.onKeyDown = (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') this.closeByKid();
      else if (e.code === 'Tab') keepTabInside(this.overlay, e);
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  /** Starts a fresh go at the quiz. */
  open(): void {
    this.run = createQuizRun(this.questions);
    this.speaker.stop();
    this.speaker.reset();
    this.overlay.hidden = false;
    this.showQuestion();
  }

  /** Closes the card without telling anyone (used when the screen itself closes). */
  close(): void {
    this.speaker.stop();
    this.overlay.hidden = true;
  }

  destroy(): void {
    this.close();
    window.removeEventListener('keydown', this.onKeyDown);
    this.overlay.remove();
  }

  private closeByKid(): void {
    this.close();
    this.callbacks.onClosed();
  }

  private showQuestion(): void {
    const run = this.run!;
    const q = run.current!;
    this.answered = false;
    this.speaker.stop();

    this.els.step.hidden = false;
    this.els.step.textContent = `Question ${run.position.number} of ${run.position.of}`;
    this.els.heading.textContent = q.question;
    this.els.stars.hidden = true;
    this.els.because.hidden = true;
    this.els.teaser.hidden = true;
    this.els.feedback.textContent = '';
    this.els.options.hidden = false;
    this.els.options.replaceChildren();
    this.optionButtons = q.options.map((option, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.testid = `quiz-option-${i}`;
      button.textContent = option.text;
      button.addEventListener('click', () => this.pick(i));
      this.els.options.appendChild(button);
      return button;
    });

    this.show('next', false);
    this.show('again', false);
    this.show('back', false);
    this.show('listen', true);
    this.els.close.textContent = 'Not now';
    this.spoken = `${q.question} ${q.options.map((o) => o.text).join('. ')}.`;
    this.setListenLabel(false);
    this.optionButtons[0].focus();
  }

  private pick(optionIndex: number): void {
    const run = this.run!;
    if (this.answered) return;
    const q = run.current!;
    const result = run.answer(optionIndex);
    const button = this.optionButtons[optionIndex];
    if (result === 'wrong') {
      // A word and a mark, not only a colour. Nothing is lost and every other answer stays open.
      button.classList.add('is-wrong');
      button.setAttribute('aria-disabled', 'true');
      button.textContent = `✗ ${q.options[optionIndex].text} – not quite`;
      this.els.feedback.textContent = 'Not quite. Try another one!';
    } else if (result === 'right') {
      this.answered = true;
      button.classList.add('is-right');
      button.textContent = `✓ ${q.options[optionIndex].text}`;
      for (const b of this.optionButtons) b.setAttribute('aria-disabled', 'true');
      this.els.feedback.textContent = 'Yes! That is right!';
      this.els.because.textContent = q.because;
      this.els.because.hidden = false;
      this.spoken = `That is right! ${q.because}`;
      this.speaker.stop();
      this.setListenLabel(false);
      this.els.next.textContent = run.finished ? 'See my stars' : 'Next question';
      this.show('next', true);
      (this.els.next as HTMLButtonElement).focus();
    }
  }

  private next(): void {
    this.speaker.stop();
    if (this.run!.finished) this.showResult();
    else this.showQuestion();
  }

  private showResult(): void {
    const run = this.run!;
    const stars = this.callbacks.onFinished(run.perfect);
    this.speaker.stop();

    this.els.step.hidden = true;
    this.els.heading.textContent = run.perfect ? 'Quiz done! Perfect!' : 'Quiz done!';
    setStars(this.els.stars, stars);
    this.els.stars.hidden = false;
    this.els.options.hidden = true;
    this.els.options.replaceChildren();
    this.optionButtons = [];
    this.els.because.hidden = true;
    this.els.feedback.textContent =
      stars >= MAX_STARS
        ? run.perfect
          ? 'All three right on the first try! You earned the bonus star!'
          : 'You have all 3 stars on this world!'
        : 'Great job! Get all three right on the first try for a bonus star.';
    this.els.teaser.textContent = this.teaser;
    this.els.teaser.hidden = false;

    this.show('next', false);
    this.show('again', true);
    this.show('back', true);
    this.show('listen', true);
    this.els.close.textContent = 'Keep exploring';
    this.spoken = `${this.els.heading.textContent} ${this.els.feedback.textContent} ${this.teaser}`;
    this.setListenLabel(false);
    (this.els.again as HTMLButtonElement).focus();
  }

  private show(name: string, visible: boolean): void {
    this.els[name].hidden = !visible;
  }

  private toggleListening(): void {
    if (this.speaker.isSpeaking()) {
      this.speaker.stop();
      this.setListenLabel(false);
      return;
    }
    this.setListenLabel(true);
    this.speaker.speak(this.spoken, () => this.setListenLabel(false));
  }

  private setListenLabel(speaking: boolean): void {
    const button = this.els.listen as HTMLButtonElement;
    if (!this.speaker.isSupported()) {
      button.textContent = 'No voice on this computer';
      button.disabled = true;
      return;
    }
    button.disabled = false;
    button.textContent = speaking ? 'Stop' : 'Listen';
    button.setAttribute('aria-pressed', String(speaking));
  }
}

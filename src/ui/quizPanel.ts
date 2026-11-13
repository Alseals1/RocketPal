import type { Speaker } from '../audio/speech';
import type { QuizQuestion } from '../data/quizzes';
import { createQuizRun, type QuizRun } from '../quiz/quiz';
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
  /** The latest feedback line, kept so Listen can read it. */
  private pendingFeedback = '';

  constructor(
    parent: HTMLElement,
    /** Draws the questions for one go. Called on every open, so a replay is a new quiz. */
    private readonly draw: () => QuizQuestion[],
    private readonly teaser: string,
    /** The title of each dot by id, so a wrong answer can point the kid to where the answer is. */
    private readonly dotTitles: Record<string, string>,
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

  /** Starts a fresh go at the quiz, with a new draw of questions. */
  open(): void {
    this.run = createQuizRun(this.draw());
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
    // A line still waiting for its animation frame must not land on the new question.
    this.pendingFeedback = '';
    this.els.options.hidden = false;
    this.els.options.replaceChildren();
    this.optionButtons = q.options.map((option, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.testid = `quiz-option-${i}`;
      this.setOption(button, '', option.text, '');
      button.addEventListener('click', () => this.pick(i));
      this.els.options.appendChild(button);
      return button;
    });

    this.show('next', false);
    this.show('again', false);
    this.show('back', false);
    this.show('listen', true);
    this.els.close.textContent = 'Not now';
    this.spoken = this.questionSpeech(q);
    this.setListenLabel(false);
    // Focus lands on the question, so a screen reader reads it; Tab then goes to the first answer.
    this.els.heading.focus();
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
      this.setOption(button, '✗', q.options[optionIndex].text, ' – not quite');
      const dot = this.dotTitles[q.hotspot];
      const line = dot ? `Not quite. Try another one! Hint: the “${dot}” dot has the answer. You can look at it after the quiz.` : 'Not quite. Try another one!';
      this.announce(line);
      this.spoken = `${line} ${this.questionSpeech(q)}`;
      this.speaker.stop();
      this.setListenLabel(false);
    } else if (result === 'right') {
      this.answered = true;
      button.classList.add('is-right');
      this.setOption(button, '✓', q.options[optionIndex].text, '');
      for (const b of this.optionButtons) b.setAttribute('aria-disabled', 'true');
      this.announce('Yes! That is right!');
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

  /** The question and its answers, as Listen reads them. */
  private questionSpeech(q: QuizQuestion): string {
    return `${q.question} ${q.options.map((o) => o.text).join('. ')}.`;
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
    this.announce(
      stars >= MAX_STARS
        ? run.perfect
          ? 'All three right on the first try! You earned the bonus star!'
          : 'You have all 3 stars on this world!'
        : `You earned ${stars} ${stars === 1 ? 'star' : 'stars'}! Play again to try for the bonus star.`,
    );
    this.els.teaser.textContent = this.teaser;
    this.els.teaser.hidden = false;

    this.show('next', false);
    this.show('again', true);
    this.show('back', true);
    this.show('listen', true);
    this.els.close.textContent = 'Keep exploring';
    this.spoken = `${this.els.heading.textContent} ${this.pendingFeedback} ${this.teaser}`;
    this.setListenLabel(false);
    (this.els.again as HTMLButtonElement).focus();
  }

  /** Sets what an answer button shows. The tick or cross is decoration (hidden from screen readers); the words say the same thing. */
  private setOption(button: HTMLButtonElement, mark: string, text: string, note: string): void {
    button.replaceChildren();
    if (mark) {
      const m = document.createElement('span');
      m.className = 'quiz-mark';
      m.setAttribute('aria-hidden', 'true');
      m.textContent = `${mark} `;
      button.appendChild(m);
    }
    button.appendChild(document.createTextNode(text + note));
  }

  /**
   * Shows a feedback line in the live region. It is cleared first, so saying the same thing twice in a row
   * (two wrong answers) is announced again by a screen reader.
   */
  private announce(text: string): void {
    this.pendingFeedback = text;
    this.els.feedback.textContent = '';
    requestAnimationFrame(() => {
      if (this.pendingFeedback === text) this.els.feedback.textContent = text;
    });
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

/**
 * Shown while the graphics card has dropped the 3D picture (a lost WebGL context). The game waits, and the picture
 * usually comes back by itself; "Start again" reloads the page if it does not. It never takes the keyboard focus,
 * and there is no timer.
 */
export class ContextLostNotice {
  private readonly el: HTMLElement;

  constructor(parent: HTMLElement, restart: () => void = () => location.reload()) {
    this.el = document.createElement('div');
    this.el.className = 'context-lost';
    this.el.dataset.testid = 'context-lost';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="card context-lost-card" role="alert">
        <h2>The picture stopped for a moment.</h2>
        <p>It should come back by itself. If it does not, press Start again.</p>
        <button class="big-button" data-testid="context-lost-restart" type="button">Start again</button>
      </div>`;
    this.el.querySelector('button')!.addEventListener('click', () => restart());
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}

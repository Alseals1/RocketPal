/** Keeps the most recent frame times (milliseconds) so the quality chooser can judge them. */
export class FrameMonitor {
  private readonly times: number[] = [];

  constructor(private readonly capacity = 90) {}

  add(ms: number): void {
    this.times.push(ms);
    if (this.times.length > this.capacity) this.times.shift();
  }

  samples(): number[] {
    return [...this.times];
  }

  /** Average frames per second over the kept frames, or 0 if there are none yet. */
  fps(): number {
    if (this.times.length === 0) return 0;
    const average = this.times.reduce((sum, ms) => sum + ms, 0) / this.times.length;
    return 1000 / average;
  }
}

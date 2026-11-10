import type { Quake } from './quakes.ts';

const tooltip = document.querySelector<HTMLDivElement>('#tooltip')!;

const utc = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
});
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// "3 days ago", or in hours or minutes when it was that recent.
function ago(time: number): string {
  const minutes = (time - Date.now()) / 60_000;
  if (minutes > -60) return relative.format(Math.round(minutes), 'minute');
  if (minutes > -24 * 60) return relative.format(Math.round(minutes / 60), 'hour');
  return relative.format(Math.round(minutes / (24 * 60)), 'day');
}

// One line of text. Everything goes in as textContent, never as HTML: the
// place names come from an outside feed.
function line(className: string, text: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}

// Shows the earthquake's details beside the pointer, at (x, y) in CSS pixels
// from the window's top-left, on whichever side has room.
export function showTooltip(quake: Quake, x: number, y: number, hint: string): void {
  tooltip.replaceChildren(
    line('tooltip-title', `M${quake.mag.toFixed(1)} · ${quake.place}`),
    line('tooltip-detail', `${Math.round(quake.depthKm)} km deep`),
    line('tooltip-detail', `${utc.format(quake.time)} UTC · ${ago(quake.time)}`),
    line('tooltip-hint', hint),
  );
  tooltip.hidden = false;
  const gap = 14;
  const { width, height } = tooltip.getBoundingClientRect();
  const left = x + gap + width <= window.innerWidth ? x + gap : x - gap - width;
  const top = y + gap + height <= window.innerHeight ? y + gap : y - gap - height;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

export function hideTooltip(): void {
  tooltip.hidden = true;
}

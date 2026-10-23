import './style.css';
import { APP_TITLE } from './app';

const root = document.getElementById('app');
if (root) {
  root.querySelector('h1')!.textContent = APP_TITLE;
}

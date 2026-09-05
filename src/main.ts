import './style.css';
import { initScene } from './render/scene';
import { mountControls } from './ui/controls';
import { mountHud } from './ui/hud';

const app = document.querySelector<HTMLDivElement>('#app')!;
initScene(app);
mountHud();
mountControls();

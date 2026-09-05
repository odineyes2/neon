import './style.css';
import { initScene } from './render/scene';
import { mountControls } from './ui/controls';
import { mountHud } from './ui/hud';
import { mountOverlayPanel } from './ui/overlayPanel';

const app = document.querySelector<HTMLDivElement>('#app')!;
initScene(app);
mountHud();
mountOverlayPanel();
mountControls();

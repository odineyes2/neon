import './style.css';
import { initScene } from './render/scene';
import { mountControls } from './ui/controls';
import { mountHud } from './ui/hud';
import { mountOverlayPanel } from './ui/overlayPanel';
import { mountCharacterPanel } from './ui/characterPanel';
import { mountEventModal } from './ui/eventModal';

const app = document.querySelector<HTMLDivElement>('#app')!;
initScene(app);
mountHud();
mountOverlayPanel();
mountCharacterPanel();
mountEventModal();
mountControls();

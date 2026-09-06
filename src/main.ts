import './style.css';
import { initScene } from './render/scene';
import { mountControls } from './ui/controls';
import { mountHud } from './ui/hud';
import { mountOverlayPanel } from './ui/overlayPanel';
import { mountCharacterPanel } from './ui/characterPanel';
import { mountEventModal } from './ui/eventModal';
import { mountSaveControls } from './ui/saveControls';
import { mountOnboarding } from './ui/onboarding';
import { useGameStore } from './sim/store';

useGameStore.getState().loadGame(); // 저장된 게임이 있으면 이어서 시작한다

const app = document.querySelector<HTMLDivElement>('#app')!;
initScene(app);
mountHud();
mountOverlayPanel();
mountCharacterPanel();
mountEventModal();
mountSaveControls();
mountOnboarding();
mountControls();

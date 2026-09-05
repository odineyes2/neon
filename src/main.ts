import './style.css';
import { initScene } from './render/scene';

const app = document.querySelector<HTMLDivElement>('#app')!;
initScene(app);

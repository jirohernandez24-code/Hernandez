// Entry point for running the 3D ward game on its own page (no React / server needed).
import { mountWardGame } from './game';

const el = document.getElementById('app')!;
mountWardGame(el);

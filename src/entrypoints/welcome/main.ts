import '../popup/style.css';
import Welcome from './Welcome.svelte';
import { mount } from 'svelte';

const app = mount(Welcome, {
  target: document.getElementById('app')!,
});

export default app;

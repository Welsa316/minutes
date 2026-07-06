import { writable } from 'svelte/store';

// Which feature the user is hovering in the hero (index into the card set), or
// null. The chips (App.svelte) write it; the 3D scene (Scene.svelte) reads it to
// pop the matching card forward — this is what ties the art to the content.
export const hoveredCard = writable(null);

// The five hero features, in the order their 3D cards are arranged.
export const FEATURES = ['Meetings', 'Clients', 'Notes', 'Boards', 'To-dos'];

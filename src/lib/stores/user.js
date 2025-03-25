import { writable } from 'svelte/store';
import { browser } from '$app/environment';

let initialValue = 1;

if (browser) {
  const stored = localStorage.getItem('selectedUserId');
  initialValue = stored ? parseInt(stored) : 1;
}

export const selectedUserId = writable(initialValue);

if (browser) {
  selectedUserId.subscribe(value => {
    if (value !== null) {
      localStorage.setItem('selectedUserId', value);
    }
  });
}

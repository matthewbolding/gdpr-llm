import { writable } from 'svelte/store';
import { browser } from '$app/environment';

let initialValue = null;

if (browser) {
  const stored = localStorage.getItem('selectedUserId');
  initialValue = stored ? parseInt(stored) : null;
}

export const selectedUserId = writable(initialValue);


if (browser) {
  selectedUserId.subscribe(value => {
    if (value !== null) {
      localStorage.setItem('selectedUserId', value);
    }
  });
}

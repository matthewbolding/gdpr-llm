<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let users = [];
  let questions = [];
  let assignments = new Set(); // `${user_id}-${question_id}`
  let assignmentInfo = new Map(); // key: `${user_id}-${question_id}`, value: { complete, time }
  let assignmentsLoaded = false;

  async function fetchData() {
    assignmentsLoaded = false;

    const [usersRes, questionsRes, assignmentsRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/questions'),
      fetch('/api/user-questions')
    ]);

    users = await usersRes.json();
    questions = (await questionsRes.json()).questions.sort((a, b) => a.question_id - b.question_id);
    const assigned = await assignmentsRes.json();

    assignments = new Set(assigned.map(a => `${a.user_id}-${a.question_id}`));
    assignments = new Set(assignments); // force reactive update

    // Show table now
    assignmentsLoaded = true;

    // Fetch per-assignment metadata lazily
    for (const { user_id, question_id } of assigned) {
      const key = `${user_id}-${question_id}`;

      // Fetch each assignment's info individually (non-blocking)
      (async () => {
        try {
          const [ratingsRes, writeinsRes, answeredRes] = await Promise.all([
            fetch(`/api/time/ratings?question_id=${question_id}&user_id=${user_id}`),
            fetch(`/api/time/writeins?question_id=${question_id}&user_id=${user_id}`),
            fetch(`/api/questions/is-answered?question_id=${question_id}&user_id=${user_id}`)
          ]);

          const ratingsTime = parseInt((await ratingsRes.json()).total_rating_time, 10) || 0;
          const writeinsTime = parseInt((await writeinsRes.json()).total_rating_time, 10) || 0;
          const isAnswered = (await answeredRes.json()).is_answered;

          // Trigger reactivity
          assignmentInfo = new Map(assignmentInfo.set(key, {
            complete: isAnswered,
            time: ratingsTime + writeinsTime
          }));
        } catch (err) {
          console.error(`Error loading metadata for ${key}: ${err.message}`);
        }
      })();
    }
  }

  function isChecked(user_id, question_id) {
    return assignments.has(`${user_id}-${question_id}`);
  }

  function keyFor(user_id, question_id) {
    return `${user_id}-${question_id}`;
  }
  
  function getAssignmentInfo(user_id, question_id) {
    return assignmentInfo.get(keyFor(user_id, question_id));
  }
  
  async function toggleAssignment(user_id, question_id) {
    const key = keyFor(user_id, question_id);
    const assigned = assignments.has(key);

    const res = await fetch('/api/user-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, question_id, assigned: !assigned })
    });

    if (!res.ok) return;

    // Force reactivity on both Set and Map
    if (assigned) {
      assignments.delete(key);
      assignments = new Set(assignments); // <== trigger UI

      assignmentInfo.delete(key);
      assignmentInfo = new Map(assignmentInfo); // <== clear metadata
    } else {
      assignments.add(key);
      assignments = new Set(assignments); // <== trigger UI

      // Immediately show loading state by setting a placeholder
      assignmentInfo.set(key, null);
      assignmentInfo = new Map(assignmentInfo);

      try {
        const [ratingsRes, writeinsRes, answeredRes] = await Promise.all([
          fetch(`/api/time/ratings?question_id=${question_id}&user_id=${user_id}`),
          fetch(`/api/time/writeins?question_id=${question_id}&user_id=${user_id}`),
          fetch(`/api/questions/is-answered?question_id=${question_id}&user_id=${user_id}`)
        ]);

        const ratingsTime = parseInt((await ratingsRes.json()).total_rating_time, 10) || 0;
        const writeinsTime = parseInt((await writeinsRes.json()).total_rating_time, 10) || 0;
        const isAnswered = (await answeredRes.json()).is_answered;

        assignmentInfo.set(key, {
          complete: isAnswered,
          time: ratingsTime + writeinsTime
        });
        assignmentInfo = new Map(assignmentInfo);
      } catch (err) {
        console.error(`Metadata fetch failed for ${key}: ${err.message}`);
      }
    }
  }

  async function toggleAllAssignmentsForUser(user_id) {
    const isFullyAssigned = questions.every(q => assignments.has(`${user_id}-${q.question_id}`));

    const updates = questions.map(async q => {
      const key = `${user_id}-${q.question_id}`;
      const assigned = assignments.has(key);
      if (isFullyAssigned && assigned) {
        await toggleAssignment(user_id, q.question_id);
      } else if (!isFullyAssigned && !assigned) {
        await toggleAssignment(user_id, q.question_id);
      }
    });

    await Promise.all(updates);
    await fetchData(); // refresh after bulk operation
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function goHome() {
    goto('/');
  }

  onMount(fetchData);
</script>

<main class="container">
  <h1>Assign Questions to Users</h1>
  <button class="home-button" on:click={goHome}>Home</button>
  {#if assignmentsLoaded}
    <table>
      <thead>
        <tr>
          <th class="id-column">ID</th>
          <th>Question</th>
          {#each users as user}
            <th>
              <div class="user-header">
                <span>{user.username}</span>
                <br>
                <button on:click={() => toggleAllAssignmentsForUser(user.user_id)} class="toggle-btn">
                  Toggle All
                </button>
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each questions as q}
          <tr>
            <td class="id-column">{q.question_id}</td>
            <td>{q.question_text}</td>
            {#each users as user}
              <td style="text-align: center;">
                {#key `${user.user_id}-${q.question_id}`} <!-- force reactivity -->
                  <div style="display: flex; align-items: center; justify-content: center; gap: 0.5em; font-size: 0.8em;">
                    <input
                      type="checkbox"
                      checked={assignments.has(`${user.user_id}-${q.question_id}`)}
                      on:change={() => toggleAssignment(user.user_id, q.question_id)} />
                  
                    {#if assignments.has(`${user.user_id}-${q.question_id}`)}
                      {#if assignmentInfo.has(`${user.user_id}-${q.question_id}`)}
                        {#if assignmentInfo.get(`${user.user_id}-${q.question_id}`) === null}
                          <span>Loading...</span>
                        {:else}
                          <span class="status {assignmentInfo.get(`${user.user_id}-${q.question_id}`).complete ? 'complete' : 'incomplete'}">
                            {assignmentInfo.get(`${user.user_id}-${q.question_id}`).complete ? 'Complete' : 'Incomplete'}
                          </span>
                          <span>{formatTime(assignmentInfo.get(`${user.user_id}-${q.question_id}`).time)}</span>
                        {/if}
                      {/if}
                    {/if}
                  </div>
                {/key}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p>Loading assignments...</p>
  {/if}
</main>

<style>
  .container {
    padding: 2rem;
  }

  button {
    padding: 0.4rem 0.75rem;
    border: none;
    border-radius: 4px;
    background-color: #007BFF;
    color: white;
    cursor: pointer;
  }

  .home-button {
    margin-bottom: 1rem;
  }

  button:hover {
    background-color: #0056b3;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th, td {
    border: 1px solid #ccc;
    padding: 0.5rem;
    font-size: 0.9rem;
    vertical-align: middle;
  }

  th {
    background-color: #f0f0f0;
  }

  .id-column {
    white-space: nowrap;
    width: 1%;
    text-align: center;
  }

  input[type="checkbox"] {
    transform: scale(1.2);
  }

  .user-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }

  .toggle-btn {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    background-color: #007BFF;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .toggle-btn:hover {
    background-color: #0056b3;
  }

  .complete {
    color: green;
  }

  .incomplete {
    color: red;
  }

  .status {
    font-weight: bold;
    margin-top: 10px;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>

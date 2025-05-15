<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let users = [];
  let questions = [];
  let assignments = new Set(); // `${user_id}-${question_id}`
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
    assignmentsLoaded = true;
  }

  function isChecked(user_id, question_id) {
    return assignments.has(`${user_id}-${question_id}`);
  }

  async function toggleAssignment(user_id, question_id) {
    const key = `${user_id}-${question_id}`;
    const assigned = assignments.has(key);

    const res = await fetch('/api/user-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, question_id, assigned: !assigned })
    });

    if (res.ok) {
      if (assigned) {
        assignments.delete(key);
      } else {
        assignments.add(key);
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
                <input
                  type="checkbox"
                  checked={isChecked(user.user_id, q.question_id)}
                  on:change={() => toggleAssignment(user.user_id, q.question_id)} />
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

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>

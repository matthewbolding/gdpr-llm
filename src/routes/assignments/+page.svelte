<script>
    import { onMount } from 'svelte';
  
    let users = [];
    let questions = [];
    let assignments = new Set(); // of `${user_id}-${question_id}`
    let assignmentsLoaded = false;
  
    async function fetchData() {
      const [usersRes, questionsRes, assignmentsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/questions?page=1&limit=1000&user_id=1'), // admin sees all
        fetch('/api/user-questions') // returns [{ user_id, question_id }]
      ]);
  
      users = await usersRes.json();
      questions = (await questionsRes.json()).questions;
      const assigned = await assignmentsRes.json();
      assignments = new Set(assigned.map(a => `${a.user_id}-${a.question_id}`));

      assignmentsLoaded = true;
    }
  
    function isChecked(user_id, question_id) {
      console.log(user_id, question_id)
      console.log(assignments.has(`${user_id}-${question_id}`))
      return assignments.has(`${user_id}-${question_id}`);
    }
  
    async function toggleAssignment(user_id, question_id) {
      const key = `${user_id}-${question_id}`;
      const assigned = assignments.has(key);

      console.log("toggleAssignment!")
      console.log(key)
      console.log(assigned)
  
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
  
    onMount(fetchData);
  </script>
  
  <main class="container">
    <h1>Assign Questions to Users</h1>
    {#if assignmentsLoaded}
    <table>
        <thead>
          <tr>
            <th>Question</th>
            {#each users as user}
              <th>{user.username}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each questions as q}
            <tr>
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
  
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
  
    th, td {
      border: 1px solid #ccc;
      padding: 0.5rem;
      font-size: 0.9rem;
    }
  
    th {
      background-color: #f0f0f0;
    }
  
    input[type="checkbox"] {
      transform: scale(1.2);
    }
  </style>
  
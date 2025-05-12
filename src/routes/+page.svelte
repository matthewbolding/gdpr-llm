<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { debounce } from 'lodash-es';

  let username = null;
  let userId = null;

  let questions = [];
  let users = [];
  let currentPage = 1;
  let totalPages = 1;
  let questionsPerPage = 5;
  let searchQuery = '';
  let hasWriteIns = {};
  let times = {}
  let completed = {}
  let dataLoaded = false;

  // Debounce the search function to prevent too many API requests
  const debouncedSearch = debounce(fetchData, 300);

  // Fetch questions with optional search query
  async function fetchData(page = 1, limit = questionsPerPage, search = '') {
    try {    
      const response = await fetch(`/api/questions?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&user_id=${userId}`);

      if (response.status === 404) {
        // No questions found
        questions = [];
        totalPages = 1;
        currentPage = 1;
        dataLoaded = true;
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      questions = data.questions;
      totalPages = data.totalPages;
      currentPage = data.currentPage;

      dataLoaded = true;
    } catch (error) {
      console.error('Error fetching data:', error);
      dataLoaded = true; // Prevents infinite loading in case of error
      questions = [];
    }
  }


  async function fetchHasWriteIns() {
    try {
      if (!questions || questions.length === 0) return;

      console.log("Fetching write-in availability for all questions...");

      // Create an array of fetch promises for all question IDs
      const writeInPromises = questions.map(async (question) => {
        try {
          const response = await fetch(`/api/has-writein?question_id=${question.question_id}`);
          if (!response.ok) throw new Error(`Error fetching write-in status for question ${question.question_id}`);

          const data = await response.json();
          return { question_id: question.question_id, has_writein: data.has_writein ?? false };
        } catch (error) {
          console.error(`Error fetching write-in status for question ${question.question_id}:`, error);
          return { question_id: question.question_id, has_writein: false }; // Ensure it gets set to false on failure
        }
      });

      // Wait for all fetches to resolve
      const results = await Promise.all(writeInPromises);

      // Store results in a dictionary-like object
      hasWriteIns = results.reduce((acc, result) => {
        acc[result.question_id] = result.has_writein;
        return acc;
      }, {});

      console.log("Write-in availability:", hasWriteIns);
    } catch (error) {
      console.error("Error fetching write-in availability:", error);
    }
  }

  async function fetchTimes() {
    if (!questions || questions.length === 0) return;

    console.log("Fetching write-in availability for all questions...");

    const timeFetchPromises = questions.map(async (question) => {
      const questionId = question.question_id;
    
      try {
        const [ratingRes, writeinRes] = await Promise.all([
          fetch(`/api/time/ratings?question_id=${questionId}`),
          fetch(`/api/time/writeins?question_id=${questionId}`)
        ]);
      
        const ratingData = await ratingRes.json();
        const writeinData = await writeinRes.json();
      
        const totalTime = parseInt(ratingData.total_rating_time, 10) + parseInt(writeinData.total_writein_time, 10);
        times[questionId] = totalTime;
      
      } catch (error) {
        console.error(`Error fetching time for question_id=${questionId}:`, error);
        times[questionId] = 0;
      }
    });

    await Promise.all(timeFetchPromises);
    console.log("Total time per question:", times);
  }

  async function fetchCompletion() {
    if (!questions || questions.length === 0) return;

    console.log("Fetching completion status for all questions...");

    const completionFetchPromises = questions.map(async (question) => {
      const questionId = question.question_id;

      try {
        const response = await fetch(`/api/questions/is-answered?question_id=${questionId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch completion status for question ${questionId}`);
        }

        const data = await response.json();
        completed[questionId] = data.is_answered ?? false;

      } catch (error) {
        console.error(`Error fetching completion for question ${questionId}:`, error);
        completed[questionId] = false; // default to false if error occurs
      }
    });

    await Promise.all(completionFetchPromises);
    console.log("Completion statuses:", completed);
  }

  async function fetchUsers() {
    try {
      const userRes = await fetch('/api/users');
      if (!userRes.ok) throw new Error('Failed to fetch users.')
      users = await userRes.json();
    } catch (err) {
      console.error('Error fetching users: ', err)
    }
  }

  async function fetchSession() {
    try {
      const res = await fetch('/api/session', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      const data = await res.json();
      userId = data.userId;
      username = data.username;
    } catch (err) {
      console.warn('No active session');
      userId = null;
      username = null;
    }
  }

  async function logout() {
    try {
      const res = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        window.location.reload();
      } else {
        console.error('Logout failed');
      }
    } catch (err) {
      console.error('Error logging out:', err);
    }
  }

  // Load data on page mount
  onMount(async () => {
    await fetchSession();
    await fetchUsers();
    await fetchData();
    await fetchHasWriteIns();
    await fetchTimes();
    await fetchCompletion();
    dataLoaded = true;
  });

  function goToQuestion(questionId) {
    goto(`/questions/${questionId}`);
  }

  function goToWriteIn(questionId) {
    goto(`/questions/${questionId}/write-in`)
  }

  function goToAssignments() {
    goto(`/assignments`);
  }

  async function handleQuestionsPerPageChange(event) {
    questionsPerPage = parseInt(event.target.value);
    await fetchData(1, questionsPerPage, searchQuery);
    await fetchTimes();
  }

  function handleSearch(event) {
    searchQuery = event.target.value;
    debouncedSearch(1, questionsPerPage, searchQuery);
  }

  async function handleUserChange(event) {
    userId = parseInt(event.target.value);
    selectedUserId.set(userId)

    await fetchData(1, questionsPerPage, searchQuery);
    await fetchTimes();
  }

  async function handlePageChange(newPage, questionsPerPage, searchQuery) {
    dataLoaded = false;
    await fetchData(newPage, questionsPerPage, searchQuery);
    await fetchHasWriteIns();
    await fetchTimes();
    await fetchCompletion();
    dataLoaded = true;
  }

</script>

<main>
  <div class="container">
    {#if !dataLoaded}
      <p>Loading data...</p>
    {:else}
      <div class="top-controls">
        <h1>Annotation Framework</h1>
    
        <div class="user-dropdown">
          {#if username}
            <p><strong>Hello, {username}</strong></p>
            <button on:click={logout}>Sign Out</button>
          {:else}
            <p>
              <em>Read-only mode (not logged in).</em>
              <a href="/login" style="margin-left: 0.5rem;">Login</a>
            </p>
          {/if}
        </div>        
    
        <div class="search-bar">
          <input
            type="text"
            aria-label="Search for a question"
            placeholder="Search..."
            bind:value={searchQuery}
            on:input={handleSearch} />
            <button on:click={goToAssignments}>Make Question Assignments</button>
        </div>
    
        <div class="per-page-control">
          <label for="questions-per-page">Questions/Page:</label>
          <select
            id="questions-per-page"
            aria-label="Select number of questions per page"
            bind:value={questionsPerPage}
            on:change={handleQuestionsPerPageChange}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
  
      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th>Status</th>
            <th>Write-In</th>
          </tr>
        </thead>
        <tbody>
          {#each questions as question}
            <tr>
              <td>
                <button on:click={() => goToQuestion(question.question_id)}>{question.question_text}</button>
              </td>
              <td>
                <p class="status {completed[question.question_id] ? 'complete' : 'incomplete'}">{completed[question.question_id] ? 'Complete' : 'Incomplete'}</p>
                {times[question.question_id]} seconds
              </td>
              <td>
                <button on:click={() => goToWriteIn(question.question_id)} disabled={!hasWriteIns[question.question_id]}>Go</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <div class="pagination">
        <button on:click={() => handlePageChange(currentPage - 1, questionsPerPage, searchQuery)} disabled={currentPage === 1}>
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button on:click={() => handlePageChange(currentPage + 1, questionsPerPage, searchQuery)} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    {/if}
  </div>
</main>

<style>
  .search-bar {
    margin-bottom: 1rem;
    text-align: right;
  }

  .search-bar input {
    padding: 0.5rem;
    width: 250px;
    border: 1px solid #ddd;
    border-radius: 5px;
  }

.top-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;

  position: sticky;
  top: 0;
  background-color: white;
  z-index: 10;
  padding: 1rem 0;
  border-bottom: 1px solid #ccc;
}


  .top-controls h1 {
    margin: 0;
    align-self: center;
  }

  .user-dropdown,
  .per-page-control,
  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-dropdown,
  .per-page-control {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
  }

  .container {
    margin: 0 auto;
    padding: 1rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.75rem;
    border-bottom: 1px solid #ddd;
    text-align: left;
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
  
  button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    border: none;
    background-color: #007BFF;
    color: white;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s ease;
  }

  button:disabled {
    background-color: #CCCCCC;
    cursor: not-allowed;
  }

  button:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .pagination {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>

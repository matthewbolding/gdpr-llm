<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { debounce } from 'lodash-es';
  import { selectedUserId } from '$lib/stores/user';

  let userId = 0;

  selectedUserId.subscribe(value => {
    userId = value;
  })();

  let questions = [];
  let users = [];
  let currentPage = 1;
  let totalPages = 1;
  let questionsPerPage = 5;
  let searchQuery = '';
  let username = '';
  let hasWriteIns = {};
  let times = {}
  let completed = {}
  let dataLoaded = false;

  // Debounce the search function to prevent too many API requests
  const debouncedSearch = debounce(fetchData, 300);

  // Fetch questions with optional search query
  async function fetchData(page = 1, limit = questionsPerPage, search = '') {
    try {
      console.log(`Fetching questions for page ${page}, limit ${limit}, search: "${search}"...`);
      
      dataLoaded = false;

      // Fetch questions with search parameter
      const response = await fetch(`http://localhost:3000/api/questions?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Questions API Response:', data);

      questions = data.questions;
      totalPages = data.totalPages;
      currentPage = data.currentPage;

      dataLoaded = true;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  async function fetchHasWriteIns() {
    try {
      if (!questions || questions.length === 0) return;

      console.log("Fetching write-in availability for all questions...");

      // Create an array of fetch promises for all question IDs
      const writeInPromises = questions.map(async (question) => {
        try {
          const response = await fetch(`http://localhost:3000/api/has-writein?question_id=${question.question_id}`);
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
          fetch(`http://localhost:3000/api/time/ratings?question_id=${questionId}`),
          fetch(`http://localhost:3000/api/time/writeins?question_id=${questionId}`)
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
        const response = await fetch(`http://localhost:3000/api/questions/is-answered?question_id=${questionId}`);
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
      const userRes = await fetch('http://localhost:3000/api/users');
      if (!userRes.ok) throw new Error('Failed to fetch users.')
      users = await userRes.json();
    } catch (err) {
      console.error('Error fetching users: ', err)
    }
  }

  // Load data on page mount
  onMount(async () => {
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

  function handleQuestionsPerPageChange(event) {
    questionsPerPage = parseInt(event.target.value);
    fetchData(1, questionsPerPage, searchQuery);
  }

  function handleSearch(event) {
    searchQuery = event.target.value;
    debouncedSearch(1, questionsPerPage, searchQuery);
  }

  async function handleUserChange(event) {
    userId = parseInt(event.target.value);
    selectedUserId.set(userId)

    await fetchData(currentPage, questionsPerPage, searchQuery);
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
  {#if !dataLoaded}
    <p>Loading data...</p>
  {:else}
    <h1>Annotation Framework</h1>

    <label for="user-select">Select your user:</label>
    <select id="user-select" bind:value={userId} on:change={handleUserChange}>
      <option disabled selected value="">-- Select a user --</option>
      {#each users as user}
        <option value={user.user_id}>{user.username}</option>
      {/each}
    </select>

    <div class="controls">
      <label for="questions-per-page">Questions per page:</label>
      <select id="questions-per-page" bind:value={questionsPerPage} on:change={handleQuestionsPerPageChange}>
        <option disabled value="">-- Select entries per page --</option>
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
      </select>
    </div>

    <div class="search-bar">
      <input type="text" bind:value={searchQuery} placeholder="Search for a question..." on:input={handleSearch} />
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

  .controls {
    margin-bottom: 1rem;
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
    border: none;
    background-color: #007BFF;
    color: white;
    cursor: pointer;
    border-radius: 5px;
  }

  button:disabled {
    background-color: #CCCCCC;
    cursor: not-allowed;
  }

  .pagination {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
    gap: 10px;
  }
</style>

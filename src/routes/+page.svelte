<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { debounce } from 'lodash-es';

  let questions = [];
  let currentPage = 1;
  let totalPages = 1;
  let questionsPerPage = 5;
  let searchQuery = ''; // User input for search
  let dataLoaded = false;

  // Debounce the search function to prevent too many API requests
  const debouncedSearch = debounce(fetchData, 300);

  // Fetch questions with optional search query
  async function fetchData(page = 1, limit = questionsPerPage, search = '') {
    try {
      console.log(`Fetching questions for page ${page}, limit ${limit}, search: "${search}"...`);
      
      dataLoaded = false;

      // Fetch questions with search parameter
      const response = await fetch(`http://localhost:3000/api/questions?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
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

  // Load data on page mount
  onMount(() => {
    fetchData();
  });

  function goToQuestion(questionId) {
    goto(`/questions/${questionId}`);
  }

  function updateQuestionsPerPage(event) {
    questionsPerPage = parseInt(event.target.value);
    fetchData(1, questionsPerPage, searchQuery);
  }

  function handleSearch(event) {
    searchQuery = event.target.value;
    debouncedSearch(1, questionsPerPage, searchQuery);
  }
</script>

<main>
  <h1>Annotation Framework</h1>
  <p>Welcome, Matthew Bolding!</p>

  <div class="search-bar">
    <input type="text" bind:value={searchQuery} placeholder="Search for a question..." on:input={handleSearch} />
  </div>

  {#if !dataLoaded}
    <p>Loading data...</p>
  {:else}
    <div class="controls">
      <label for="questions-per-page">Questions per page:</label>
      <select id="questions-per-page" bind:value={questionsPerPage} on:change={updateQuestionsPerPage}>
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </select>
    </div>

    <table>
      <thead>
        <tr>
          <th>Question</th>
          <th>Pairs Answering Progress</th>
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
              <progress max="100" value="0"></progress> <!-- Placeholder progress bar -->
            </td>
            <td>
              <span>-</span> <!-- Placeholder for write-in -->
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="pagination">
      <button on:click={() => fetchData(currentPage - 1, questionsPerPage, searchQuery)} disabled={currentPage === 1}>
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button on:click={() => fetchData(currentPage + 1, questionsPerPage, searchQuery)} disabled={currentPage === totalPages}>
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

  progress {
    width: 100px;
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

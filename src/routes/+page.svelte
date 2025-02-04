<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let questions = [];
  let latestResponses = [];
  let currentPage = 1;
  let totalPages = 1;
  let questionsPerPage = 5; // Default number of questions per page
  let dataLoaded = false; // Ensures data is loaded before rendering

  // Fetch questions and latest responses
  async function fetchData(page = 1, limit = questionsPerPage) {
    try {
      console.log(`Fetching questions for page ${page} with limit ${limit}...`);

      dataLoaded = false; // Prevent stale data from appearing
      latestResponses = []; // Reset latest responses before fetching

      // Fetch questions
      const questionsRes = await fetch(`http://localhost:3000/api/questions?page=${page}&limit=${limit}`);
      const questionsData = await questionsRes.json();

      console.log('Questions API Response:', questionsData);

      questions = questionsData.questions;
      totalPages = questionsData.totalPages;
      currentPage = questionsData.currentPage;

      // Fetch latest responses for each question
      const responsesPromises = questions.map(async (question) => {
        const responsesRes = await fetch(`http://localhost:3000/api/responses?questionId=${question.question_id}`);
        if (responsesRes.ok) {
          const responsesData = await responsesRes.json();
          return { question_id: question.question_id, responses: responsesData.responses };
        }
        return { question_id: question.question_id, responses: [] };
      });

      latestResponses = await Promise.all(responsesPromises);

      console.log('Latest Responses API Response:', latestResponses);
      dataLoaded = true; // Mark data as loaded

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  // Load questions and responses on page mount
  onMount(() => {
    fetchData();
  });

  // Navigate to the individual question page
  function goToQuestion(questionId) {
    goto(`/questions/${questionId}`);
  }

  // Update results when the number of questions per page changes
  function updateQuestionsPerPage(event) {
    questionsPerPage = parseInt(event.target.value);
    dataLoaded = false; // Reset loading flag
    fetchData(1, questionsPerPage); // Reset to page 1 when limit changes
  }

  // Get latest responses for a given question ID
  function getLatestResponsesForQuestion(questionId) {
    if (!dataLoaded) return []; // Prevent errors if data isn't loaded yet

    const result = latestResponses.find(item => item.question_id === questionId);
    return result ? result.responses : [];
  }
</script>

<main>
  <h1>GDPR Questions & Responses</h1>

  <!-- Show loading message while data is being fetched -->
  {#if !dataLoaded}
    <p>Loading data...</p>
  {:else}

    <!-- Dropdown for selecting questions per page -->
    <div class="controls">
      <label for="questions-per-page">Questions per page:</label>
      <select id="questions-per-page" bind:value={questionsPerPage} on:change={updateQuestionsPerPage}>
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </select>
    </div>
    <ul>
      {#each questions as question}
        <li>
          <div>
            <h2>{question.text}</h2>
            <ul>
              {#each getLatestResponsesForQuestion(question.question_id) as response}
                <li>
                  <p><strong>Model:</strong> {response.model}</p>
                  <p><strong>Text:</strong> {response.response_text}</p>
                  <p><strong>Status:</strong> {response.status}</p>
                </li>
              {/each}
            </ul>
            <button on:click={() => goToQuestion(question.question_id)}>View Question</button>
          </div>
        </li>
      {/each}
    </ul>

    <!-- Pagination Controls -->
    <div class="pagination">
      <button on:click={() => fetchData(currentPage - 1, questionsPerPage)} disabled={currentPage === 1}>
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button on:click={() => fetchData(currentPage + 1, questionsPerPage)} disabled={currentPage === totalPages}>
        Next
      </button>
    </div>

  {/if}
</main>

<style>
  .controls {
    margin-bottom: 1rem;
  }

  ul {
    list-style-type: none;
    padding: 0;
  }

  li {
    margin-bottom: 1rem;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 5px;
  }

  .pagination {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
    gap: 10px;
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
</style>

<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { selectedUserId } from '$lib/stores/user';

  let userId = 0;

  selectedUserId.subscribe(value => {
    userId = value;
  })();
  
  let username = '';
  let questionId;
  let questionText = '';
  let generations = [];
  let selectedGenerations = {};
  let writeinText = '';
  let saved_writein_text = ''
  let saved_writein_gens = []
  let answered = false;
  let dataLoaded = false;
  let startTime = 0;
  
  // Extract question_id from URL
  $: questionId = $page.params.id;
  
  // Fetch question text and generations
  async function fetchData() {
    try {
      console.log(`Fetching data for question_id=${questionId}`);

      // Fetch question text
      const questionResponse = await fetch(`/api/question?question_id=${questionId}`);
      if (!questionResponse.ok) {
        throw new Error(`Error fetching question text! Status: ${questionResponse.status}`);
      }
      const questionData = await questionResponse.json();
      questionText = questionData.question_text;

      // Fetch generations
      const generationsResponse = await fetch(`/api/generations?question_id=${questionId}&user_id=${userId}`);
      if (!generationsResponse.ok) {
        throw new Error(`Error fetching generations! Status: ${generationsResponse.status}`);
      }
      const generationsData = await generationsResponse.json();
      generations = generationsData.generations;

      // Initialize selection state
      generations.forEach(gen => selectedGenerations[gen.generation_id] = false);

      // Fetch write-in, allow 404s without stopping the flow
      try {
        const writeInResponse = await fetch(`/api/writeins/latest?question_id=${questionId}`);
        if (!writeInResponse.ok) {
          if (writeInResponse.status !== 404) {
            throw new Error(`Unexpected write-in error: ${writeInResponse.status}`);
          }
        } else {
          const ratingsData = await writeInResponse.json();
          saved_writein_text = ratingsData.writein_text;
          saved_writein_gens = ratingsData.generation_ids;

          writeinText = saved_writein_text;
          saved_writein_gens.forEach(index => {
            if (selectedGenerations.hasOwnProperty(index)) {
              selectedGenerations[index] = true;
            }
          });

          answered = true;
        }
      } catch (writeInErr) {
        console.warn(`No write-in found or other error: ${writeInErr.message}`);
      }

      startTime = Date.now();
      dataLoaded = true;

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  async function fetchSession() {
    try {
      const res = await fetch('/api/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        userId = data.userId;
        username = data.username;
      }
    } catch (err) {
      console.warn('Not logged in.');
    }
  }
  
  function toggleGenerationSelection(generationId) {
    selectedGenerations[generationId] = !selectedGenerations[generationId];
  }
  
  async function submitWriteIn() {
    let endTime = Date.now();
    let timeSpent = Math.floor((endTime - startTime) / 1000);
    
    try {
      const response = await fetch('/api/writeins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          writein_text: writeinText,
          generations: Object.entries(selectedGenerations).map(([generation_id, used]) => ({
            generation_id: parseInt(generation_id),
            used
          })),
          time_spent: timeSpent,
          user_id: userId
        })
      });
  
    if (!response.ok) throw new Error('Failed to submit write-in');
    } catch (error) {
      console.error('Error submitting write-in:', error);
    }

    await fetchData();
  }
  
  function goToQuestion(questionId) {
    goto(`/questions/${questionId}`);
  }

  function goHome() {
    goto('/');
  }
  
  onMount(async () => {
    await fetchSession();
    await fetchData();
  });
</script>
  
<main>
  {#if !dataLoaded}
    <p>Loading data...</p>
  {:else}
    <h1>{questionId}: {questionText}</h1>

    <div class="user-banner">
      {#if username}
        <p><strong>Annotating as {username}</strong></p>
      {/if}
    </div>

    <div class="container-layout">
      <div class="scroll-pane">
        <div class="generation-output">
          {#each generations as gen}
            {#if selectedGenerations[gen.generation_id]}
              <div class="generation">
                <h3>Generator {gen.model_id}</h3>
                <div style="white-space: pre-line;">{gen.generation_text}</div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <div class="fixed-pane">
        <div class="instructions">
          <h3>Instructions</h3>
          <p>Select the generators whose outputs from which you intend to use to create your own answer to the question. You may only view the generator's outputs you have selected. You don't have to use any generators if no part of any generators are usable.</p>
          {#each generations as gen}
            <label>
              <input
                type="checkbox"
                bind:checked={selectedGenerations[gen.generation_id]}
                aria-label="Select Generator {gen.model_id}"
              />
              Generator {gen.model_id}
            </label>
          {/each}
          <textarea
            bind:value={writeinText}
            placeholder="Write your entry here..."
            aria-label="Write-in text area">
          </textarea>
          <br><br>
          <button class="button" on:click={submitWriteIn}>Submit</button>
        </div>
      </div>
    </div>

    <div class="navigation">
      <button class="button" on:click={goHome}>Home</button>
      <p class="status {answered ? 'answered' : 'unanswered'}">{answered ? 'Answered' : 'Unanswered'}</p>
      <button class="button" on:click={() => goToQuestion(questionId)}>Return</button>
    </div>
  {/if}
</main>
  
<style>
.container-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  height: 70vh;
}

.fixed-pane {
  flex: 0 0 50%;
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 10px;
}

.scroll-pane {
  flex: 1;
  overflow-y: auto;
  max-height: 70vh;
  padding-left: 10px;
}

.generation-output {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.generation {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
}

textarea {
  width: 100%;
  height: 100px;
  margin-top: 10px;
  font-family: inherit;
}

.navigation {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 20px;
}


  .status {
    text-align: center;
    font-weight: bold;
    margin-top: 10px;
  }

  .answered {
    color: green;
  }

  .unanswered {
    color: red;
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
  
  button:hover:not(:disabled) {
    background-color: #0056b3;
  }
  
  button:disabled {
    background-color: #CCCCCC;
    cursor: not-allowed;
  }

  .user-banner {
    text-align: center;
    margin-top: 1rem;
    font-weight: 600;
    font-size: 1.1rem;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>
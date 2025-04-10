<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
	import { goto } from '$app/navigation';
  import { selectedUserId } from '$lib/stores/user';

  let userId = 0;

  selectedUserId.subscribe(value => {
    userId = value;
  })();

  let questionId;
  let pairs = [];
  let ratings = [];
  let questionText;
  let currentIndex = 0;
  let startTime = 0;
  let answered = true;
  let dataLoaded = false;
  let writein_page = false;

  // Extract question_id from URL
  $: questionId = $page.params.id;

  // User's selection state
  let user_selection = ''; // Stores user selection from the database
  let local_user_selection = ''; // Stores the local user selection

  // Fetch pairs and question text for the given question ID
  async function fetchData() {
    try {
      console.log(`Fetching data for question_id=${questionId}`);

      // Fetch question text
      const questionResponse = await fetch(`http://localhost:3000/api/question?question_id=${questionId}`);
      if (!questionResponse.ok) {
        throw new Error(`Error fetching question text! Status: ${questionResponse.status}`);
      }
      const questionData = await questionResponse.json();
      questionText = questionData.question_text;

      // Fetch pairs
      const pairsResponse = await fetch(`http://localhost:3000/api/pairs?question_id=${questionId}`);
      if (!pairsResponse.ok) {
        throw new Error(`Error fetching pairs! Status: ${pairsResponse.status}`);
      }
      const pairsData = await pairsResponse.json();
      pairs = pairsData.pairs;

      // Fetch whether question has writein
      const writeInResponse = await fetch(`http://localhost:3000/api/has-writein?question_id=${questionId}`);
      if (!writeInResponse.ok) {
        throw new Error(`Error fetching pairs! Status: ${writeInResponse.status}`);
      }
      const writeInResponseData = await writeInResponse.json();
      writein_page = writeInResponseData.has_writein;

      // Fetch ratings
      const ratingsResponse = await fetch(`http://localhost:3000/api/ratings?question_id=${questionId}`);
      if (!ratingsResponse.ok) {
        if (ratingsResponse.status === 404) {
          ratings = []; // No ratings found, keep it an empty array
        } else {
          throw new Error(`Error fetching ratings! Status: ${ratingsResponse.status}`);
        }
      } else {
        const ratingsData = await ratingsResponse.json();
        ratings = ratingsData.ratings;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  async function submitSelection() {
    if (!local_user_selection) return;

    let endTime = Date.now();
    let timeSpent = Math.floor((endTime - startTime) / 1000);

    try {
      const response = await fetch('http://localhost:3000/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          gen_1_id: pairs[currentIndex].gen_1_id,
          gen_2_id: pairs[currentIndex].gen_2_id,
          selection: local_user_selection,
          time_spent: timeSpent,
          user_id: userId
        })
      });

      if (!response.ok) throw new Error('Failed to submit selection.');
      
    } catch (error) {
      console.error('Error submitting selection:', error);
    }
    
    await fetchData();
    await prepareView();

    startTime = Date.now();
  }

  async function prepareView() {
    let selected_rating = ratings.find(
      (r) => r.gen_id_1 === pairs[currentIndex].gen_1_id && r.gen_id_2 === pairs[currentIndex].gen_2_id
    );

    if(selected_rating) {
      user_selection = selected_rating.user_selection;
      local_user_selection = selected_rating.user_selection;
      answered = true;
    } else {
      user_selection = ''
      local_user_selection = ''
      answered = false;
    }
  }

  // Move between pairs
  function previousPair() {
    if (currentIndex > 0) {
      currentIndex--;
      prepareView();
      startTime = Date.now();
    }
  }

  function nextPair() {
    if (currentIndex < pairs.length - 1) {
      currentIndex++;
      prepareView();
      startTime = Date.now();
    }
  }

  function goHome() {
    goto('/');
  }

  function goToWriteIn(questionId) {
    goto(`/questions/${questionId}/write-in`)
  }

  // Load pairs on mount
  onMount(async () => {
    await fetchData();
    await prepareView();
    startTime = Date.now();
    dataLoaded = true;
  });
</script>

<main>
  {#if !dataLoaded}
    <p>Loading data...</p>
  {:else}
    <h1>{questionId}: {questionText}</h1>
    <!-- <h1>User ID: {userId}</h1> -->

    {#if pairs.length > 0}
      <div class="container">
        
        <!-- Generator X -->
        <div class="generation">
          <h3>Generator {pairs[currentIndex].gen_1_model_id}</h3>
          <p>{pairs[currentIndex].gen_1_text}</p>
        </div>

        <!-- Generator Y -->
        <div class="generation">
          <h3>Generator {pairs[currentIndex].gen_2_model_id}</h3>
          <p>{pairs[currentIndex].gen_2_text}</p>
        </div>

        <!-- Instructions -->
        <div class="instructions">
          <h3>Instructions</h3>
          <p>Make only one selection as to the usability or unusability of a generator's output. You may change your selection at anytime. Your most recent selection is indicated below.</p>
          
          <!-- Usability Selection -->
          <label>
            <input type="radio" name="selection" bind:group={local_user_selection} value="both_unusable"/>
            Both Generator {pairs[currentIndex].gen_1_model_id} and Generator {pairs[currentIndex].gen_2_model_id} are <span class="unusable">unusable</span> <em>as they are</em>.
          </label>
          <label>
            <input type="radio" name="selection" bind:group={local_user_selection} value="gen_1_usable"/>
            Generator {pairs[currentIndex].gen_1_model_id} is <span class="usable">usable</span> and Generator {pairs[currentIndex].gen_2_model_id} is <span class="unusable">unusable</span> <em>as they are</em>.
          </label>
          <label>
            <input type="radio" name="selection" bind:group={local_user_selection} value="gen_2_usable"/>
            Generator {pairs[currentIndex].gen_1_model_id} is <span class="unusable">unusable</span> and Generator {pairs[currentIndex].gen_2_model_id} <span class="usable">usable</span> <em>as they are</em>.
          </label>

          <p>If both Generator 1 and Generator 2 are <span class="usable">usable</span>  <em>as they are</em>, which one do you prefer?</p>
          <label>
            <input type="radio" name="selection" bind:group={local_user_selection} value="both_usable_pref_1"/>
            Generator {pairs[currentIndex].gen_1_model_id}
          </label>
          <label>
            <input type="radio" name="selection" bind:group={local_user_selection} value="both_usable_pref_2"/>
            Generator {pairs[currentIndex].gen_2_model_id}
          </label>
          <label>
            <input type="radio" name="selection" bind:group={local_user_selection} value="both_usable_no_pref"/>
            Both Equal
          </label>
          <br>
          <button class="button" on:click={submitSelection}>Submit</button>
          <br>
          {#if answered}
            <p>Your evaluation is...</p>

            <ul style="list-style-type:none;">
              {#if user_selection === 'both_unusable'}
                <li>Generator {pairs[currentIndex].gen_1_model_id} is <span class="unusable">unusable</span></li>
                <li>Generator {pairs[currentIndex].gen_2_model_id} is <span class="unusable">unusable</span></li>
              {:else if user_selection === 'gen_1_usable'}
                <li>Generator {pairs[currentIndex].gen_1_model_id} is <span class="usable">usable</span></li>
                <li>Generator {pairs[currentIndex].gen_2_model_id} is <span class="unusable">unusable</span></li>
              {:else if user_selection === 'gen_2_usable'}
                <li>Generator {pairs[currentIndex].gen_1_model_id} is <span class="unusable">unusable</span></li>
                <li>Generator {pairs[currentIndex].gen_2_model_id} is <span class="usable">usable</span></li>
              {:else}
                <li>Generator {pairs[currentIndex].gen_1_model_id} is <span class="usable">usable</span></li>
                <li>Generator {pairs[currentIndex].gen_2_model_id} is <span class="usable">usable</span></li>
              {/if}
            </ul>
            {#if user_selection === 'both_usable_pref_1'}
              <p>and you prefer Generator {pairs[currentIndex].gen_1_model_id}.</p>
            {:else if user_selection === 'both_usable_pref_2'}
              <p>and you prefer Generator {pairs[currentIndex].gen_2_model_id}.</p>
            {:else if user_selection === 'both_usable_no_pref'}
              <p>and you have no preferene.</p>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="navigation">
        <button class="button" on:click={previousPair} disabled={currentIndex === 0}>Previous Pair</button>
        <button class="button" on:click={goHome}>Home</button>
        <p class="status {answered ? 'answered' : 'unanswered'}">{answered ? 'Answered' : 'Unanswered'}</p>
        <button class="button" on:click={() => goToWriteIn(questionId)} disabled={!writein_page}>Write-In</button>
        <button class="button" on:click={nextPair} disabled={currentIndex === pairs.length - 1}>Next Pair</button>
      </div>

    {:else}
      <p>No pairs found for this question.</p>
    {/if}
  {/if}
</main>

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    align-items: start;
    text-align: left;
    height: calc(100vh - 200px);
  }

  .generation {
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    height: 95%;
    overflow-y: auto;
  }

  .instructions {
    padding: 10px;
    border-radius: 5px;
    height: 95%;
    overflow-y: auto;
  }

  label {
    display: block;
    margin-bottom: 10px;
  }

  .usable, .answered {
    color: green;
  }

  .unusable, .unanswered {
    color: red;
  }

  .status {
    text-align: center;
    font-weight: bold;
    margin-top: 10px;
  }

  .navigation {
    margin-top: 20px;
    display: flex;
    justify-content: center;
    gap: 20px;
  }

  button {
    padding: 10px;
    cursor: pointer;
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

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>

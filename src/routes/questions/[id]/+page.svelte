<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
	import { goto } from '$app/navigation';

  let questionId;
  let pairs = [];
  let questionText;
  let currentIndex = 0;
  let dataLoaded = false;

  // Extract question_id from URL
  $: questionId = $page.params.id;

  // User's selection state
  let user_selection = ''; // Stores user_selection selection

  // Fetch pairs for the given question ID
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

      dataLoaded = true;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  } 

  // Move between pairs
  function previousPair() {
    if (currentIndex > 0) {
      currentIndex--;
      user_selection = '';
    }
  }

  function nextPair() {
    if (currentIndex < pairs.length - 1) {
      currentIndex++;
      user_selection = '';
    }
  }

  function goHome() {
    goto('/');
  }

  function goToWriteIn() {
    // goto('/question/[id]/writein')
  }

  // Load pairs on mount
  onMount(() => {
    fetchData();
  });
</script>

<main>
  {#if !dataLoaded}
    <p>Loading data...</p>
  {:else}
    <h1>{questionId}: {questionText}</h1>

    {#if pairs.length > 0}
      <div class="container">
        
        <!-- Generator 1 -->
        <div class="generation">
          <h3>Generator {pairs[currentIndex].gen_1_model_id}</h3>
          <p>{pairs[currentIndex].gen_1_text}</p>
        </div>

        <!-- Generator 2 -->
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
            <input type="radio" name="selection" bind:group={user_selection} value="both_unusable"/>
            Both Generator {pairs[currentIndex].gen_1_model_id} and Generator {pairs[currentIndex].gen_2_model_id} are <span class="unusable">unusable</span> <em>as they are</em>.
          </label>
          <label>
            <input type="radio" name="selection" bind:group={user_selection} value="gen1_usable"/>
            Generator {pairs[currentIndex].gen_1_model_id} is <span class="usable">usable</span> and Generator {pairs[currentIndex].gen_2_model_id} is <span class="unusable">unusable</span> <em>as they are</em>.
          </label>
          <label>
            <input type="radio" name="selection" bind:group={user_selection} value="gen2_usable"/>
            Generator {pairs[currentIndex].gen_1_model_id} is <span class="unusable">unusable</span> and Generator {pairs[currentIndex].gen_2_model_id} <span class="usable">usable</span> <em>as they are</em>.
          </label>

          <p>If both Generator 1 and Generator 2 are <span class="usable">usable</span>  <em>as they are</em>, which one do you prefer?</p>
          <label>
            <input type="radio" name="selection" bind:group={user_selection} value="gen1_pref"/>
            Generator {pairs[currentIndex].gen_1_model_id}
          </label>
          <label>
            <input type="radio" name="selection" bind:group={user_selection} value="gen2_pref"/>
            Generator {pairs[currentIndex].gen_2_model_id}
          </label>
          <label>
            <input type="radio" name="selection" bind:group={user_selection} value="equal"/>
            Both Equal
          </label>

          <button class="submit-btn">Submit</button>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="navigation">
        <button on:click={previousPair} disabled={currentIndex === 0}>Previous Pair</button>
        <button on:click={goHome}>Home</button>
        <button on:click={goToWriteIn} disabled>Write-In</button>
        <button on:click={nextPair} disabled={currentIndex === pairs.length - 1}>Next Pair</button>
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
    height: calc(100vh - 200px); /* Adjust based on header/footer size */
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

  .usable {
    color: green;
  }

  .unusable {
    color: red;
  }

  .submit-btn {
    margin-top: 10px;
    margin-bottom: 10px;
    background-color: #007BFF;
    color: white;
    border: none;
    cursor: pointer;
    border-radius: 5px;
    align-content: center;
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
</style>

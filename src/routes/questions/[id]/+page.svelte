<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { tick } from 'svelte';

  $: id = $page.params.id;

  let question = null;
  let modifiedTexts = {}; // Ensures each answer has its own reactive value
  let unsavedChanges = false;

  // Fetch question details
  async function fetchQuestion() {
    try {
      console.log(`Fetching question with ID: ${id}`);

      // Fetch the question text
      const questionRes = await fetch(`http://localhost:3000/api/question?questionId=${id}`);
      const questionData = await questionRes.json();

      if (!questionData || !questionData.question || questionData.question.length === 0) {
        console.error("Error: No question found.");
        return;
      }

      // Extract the actual question object
      question = questionData.question[0];

      // Fetch the latest answers for this question
      const answersRes = await fetch(`http://localhost:3000/api/question-info?questionId=${id}`);
      const answersData = await answersRes.json();

      console.log('Fetched question and answers:', { question, answers: answersData });

      if (!answersData || !answersData.answers) {
        console.error("Error: Missing answers in API response.");
        return;
      }

      // Attach answers to the question
      question.answers = answersData.answers;

      // Initialize modifiedTexts for each answer
      modifiedTexts = {};
      for (const answer of question.answers) {
        modifiedTexts[answer.id] = answer.final_text || ''; // Ensure default values
      }

      // Wait for UI updates
      await tick();
    } catch (error) {
      console.error('Error fetching question:', error);
    }
  }

  // Update modifiedTexts manually to ensure proper reactivity
  function updateText(answerId, event) {
    modifiedTexts = { ...modifiedTexts, [answerId]: event.target.value };
    unsavedChanges = true;
  }

  // Save modifications
  async function saveChanges() {
    try {
      for (const [answerId, text] of Object.entries(modifiedTexts)) {
        await fetch(`http://localhost:3000/api/edits?answer_id=${answerId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 1, modifiedText: text })
        });
      }
      unsavedChanges = false;
      alert('Changes saved!');
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Failed to save changes.');
    }
  }

  // Reset modifications
  function resetChanges() {
    if (question && question.answers) {
      modifiedTexts = {};
      for (const answer of question.answers) {
        modifiedTexts[answer.id] = answer.final_text || ''; // Reset to original value
      }
    }
    unsavedChanges = false;
  }

  // Go back to the home page
  function goToHomePage() {
    goto('/');
  }

  // Warn before leaving the page (Only in browser)
  if (typeof window !== 'undefined') {
    window.onbeforeunload = () => {
      if (unsavedChanges) {
        return 'You have unsaved changes!';
      }
    };
  }

  onMount(() => {
    fetchQuestion();
  });
</script>

<main>
  {#if question}
    <h1 class="title">{question.text}</h1>

    <div class="answer-container">
      {#if question.answers && question.answers.length > 0}
        {#each question.answers as answer, index (answer.id || index)}
          <div class="answer-box">
            <h3 class="model-title">{answer.model_name}</h3>
            <textarea
              value={modifiedTexts[answer.id] || ''}
              on:input={(event) => updateText(answer.id, event)}
            ></textarea>
          </div>
        {/each}
      {:else}
        <p class="no-answers">No answers available.</p>
      {/if}
    </div>

    <div class="button-container">
      <button class="save-btn" on:click={saveChanges}>Save for Later</button>
      <button class="reset-btn" on:click={resetChanges}>Reset</button>
    </div>

    <div class="nav-container">
      <button class="home-btn" on:click={goToHomePage}>Back to Home</button>
    </div>
  {:else}
    <p class="loading">Loading question...</p>
  {/if}
</main>

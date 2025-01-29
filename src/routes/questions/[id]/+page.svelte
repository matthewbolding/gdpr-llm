<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { tick } from 'svelte';

  $: id = $page.params.id;

  let question = null;
  let modifiedTexts = {}; // Stores the text for each answer
  let unsavedChanges = false;

  // Fetch question details
  async function fetchQuestion() {
    try {
      console.log(`Fetching question with ID: ${id}`);

      const questionRes = await fetch(`http://localhost:3000/api/question?questionId=${id}`);
      const questionData = await questionRes.json();

      if (!questionData || !questionData.question || questionData.question.length === 0) {
        console.error("Error: No question found.");
        return;
      }

      question = questionData.question[0];

      // Fetch the latest answers for this question
      const answersRes = await fetch(`http://localhost:3000/api/question-info?questionId=${id}`);
      const answersData = await answersRes.json();

      console.log('Fetched question and answers:', { question, answers: answersData });

      if (!answersData || !answersData.answers) {
        console.error("Error: Missing answers in API response.");
        return;
      }

      question.answers = answersData.answers;
      console.log(question.answers)
      
      // Initialize modifiedTexts for each answer
      modifiedTexts = {};
      for (const answer of question.answers) {
        modifiedTexts[answer.answer_id] = answer.final_text
        modifiedTexts = { ...modifiedTexts };
      }

      await tick();
    } catch (error) {
      console.error('Error fetching question:', error);
    }
  }

  function updateText(answerId, event) {
    modifiedTexts[answerId] = event.target.value;
    modifiedTexts = { ...modifiedTexts }; // Ensure reactivity
    unsavedChanges = true;
  }

  async function saveChanges(answerId) {
    try {
      const text = modifiedTexts[answerId];
      await fetch(`http://localhost:3000/api/edits?answer_id=${answerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 999, modifiedText: text, status: "in progress" })
      });

      unsavedChanges = false;
      alert('Changes saved!');
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Failed to save changes.');
    }
  }

  function resetChanges(answerId) {
    if (question && question.answers) {
      const answer = question.answers.find(a => a.answer_id === answerId);
      console.log(answer)
      if (answer) {
        modifiedTexts = { ...modifiedTexts, [answerId]: answer.final_text || '' }; // Reset only the specific answer
      }
    }
    unsavedChanges = false;
  }

  function goToHomePage() {
    goto('/');
  }

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
        {#each question.answers as answer, index (answer.answer_id || index)}
          <div class="answer-box">
            <h3 class="model-title">{answer.model_name}</h3>
            <textarea
              bind:value={modifiedTexts[answer.answer_id]}
              on:input={(event) => updateText(answer.answer_id, event)}
            ></textarea>
            <button class="save-btn" on:click={() => saveChanges(answer.answer_id)}>Save</button>
            <div class="button-container">
              <button class="reset-btn" on:click={() => resetChanges(answer.answer_id)}>Reset</button>
            </div>
          </div>
        {/each}
      {:else}
        <p class="no-answers">No answers available.</p>
      {/if}
    </div>

    <div class="nav-container">
      <button class="home-btn" on:click={goToHomePage}>Back to Home</button>
    </div>
  {:else}
    <p class="loading">Loading question...</p>
  {/if}
</main>

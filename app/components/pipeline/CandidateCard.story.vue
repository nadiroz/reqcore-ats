<script setup lang="ts">
import CandidateCard from './CandidateCard.vue'
</script>

<template>
  <Story title="Pipeline / CandidateCard" :layout="{ type: 'grid', width: 320 }">
    <Variant title="Default">
      <CandidateCard
        id="1"
        candidate-first-name="Joshua"
        candidate-last-name="Addey"
        candidate-email="addey@gmail.com"
        :score="73"
        :created-at="new Date(Date.now() - 2 * 86400000).toISOString()"
        status="interview"
      />
    </Variant>

    <Variant title="Selected">
      <CandidateCard
        id="2"
        candidate-first-name="Sarah"
        candidate-last-name="Chen"
        candidate-email="sarah.chen@example.com"
        :score="89"
        :created-at="new Date(Date.now() - 86400000).toISOString()"
        status="interview"
        selected
      />
    </Variant>

    <Variant title="No Score">
      <CandidateCard
        id="3"
        candidate-first-name="David"
        candidate-last-name="Okonkwo"
        candidate-email="david.o@example.com"
        :score="null"
        :created-at="new Date(Date.now() - 5 * 86400000).toISOString()"
        status="new"
      />
    </Variant>

    <Variant title="With Interview Badge">
      <CandidateCard
        id="4"
        candidate-first-name="Favour"
        candidate-last-name="Udoh"
        candidate-email="favour@xanthiia.io"
        :score="65"
        :created-at="new Date(Date.now() - 3600000).toISOString()"
        status="interview"
        has-interview
      />
    </Variant>

    <Variant title="Pending Gate Stage">
      <CandidateCard
        id="5"
        candidate-first-name="Mike"
        candidate-last-name="Johnson"
        candidate-email="mike.j@example.com"
        :score="42"
        :created-at="new Date(Date.now() - 7 * 86400000).toISOString()"
        status="screening"
        pending-gate="Assessment R1"
      />
    </Variant>

    <Variant title="High Score">
      <CandidateCard
        id="6"
        candidate-first-name="Amara"
        candidate-last-name="Nwosu"
        candidate-email="amara.nwosu@longdomainname.example.com"
        :score="95"
        :created-at="new Date().toISOString()"
        status="offer"
      />
    </Variant>
  </Story>
</template>

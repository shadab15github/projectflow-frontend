<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
</script>

<template>
  <div class="max-w-3xl space-y-4 p-6">
    <h1 class="text-2xl font-semibold">For You</h1>
    <Card>
      <CardHeader>
        <CardTitle>Personalized feed</CardTitle>
        <CardDescription>
          Tasks assigned to you and recent activity across your projects will
          appear here.
        </CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        Coming soon.
      </CardContent>
    </Card>
  </div>
</template>

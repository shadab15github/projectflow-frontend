<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface FieldErrors {
  email?: string;
  password?: string;
}

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ email: '', password: '' });
const fieldErrors = reactive<FieldErrors>({});
const formError = ref<string | null>(null);
const submitting = ref(false);

function validate(): boolean {
  fieldErrors.email = undefined;
  fieldErrors.password = undefined;
  let ok = true;

  if (!form.email.trim()) {
    fieldErrors.email = 'Email is required';
    ok = false;
  } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
    fieldErrors.email = 'Enter a valid email';
    ok = false;
  }

  if (!form.password) {
    fieldErrors.password = 'Password is required';
    ok = false;
  }

  return ok;
}

async function onSubmit(): Promise<void> {
  formError.value = null;
  if (!validate()) return;

  submitting.value = true;
  try {
    await auth.login({ email: form.email.trim(), password: form.password });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/app';
    await router.replace(redirect);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = (err.response?.data as { message?: string } | undefined)?.message;
      formError.value = message ?? 'Login failed. Please try again.';
    } else {
      formError.value = 'Unexpected error. Please try again.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Welcome back</CardTitle>
      <CardDescription>Log in to your ProjectFlow workspace.</CardDescription>
    </CardHeader>

    <form @submit.prevent="onSubmit" novalidate>
      <CardContent class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            :aria-invalid="!!fieldErrors.email"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.email" class="text-sm text-destructive">{{ fieldErrors.email }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            :aria-invalid="!!fieldErrors.password"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.password" class="text-sm text-destructive">
            {{ fieldErrors.password }}
          </p>
        </div>

        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
      </CardContent>

      <CardFooter class="flex flex-col gap-3">
        <Button type="submit" class="w-full" :disabled="submitting">
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </Button>
        <p class="text-sm text-muted-foreground">
          Don't have an account?
          <RouterLink to="/signup" class="underline underline-offset-4">Sign up</RouterLink>
        </p>
      </CardFooter>
    </form>
  </Card>
</template>

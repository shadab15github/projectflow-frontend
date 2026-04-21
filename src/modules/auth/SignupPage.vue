<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
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
  name?: string;
  email?: string;
  password?: string;
  orgName?: string;
}

const auth = useAuthStore();
const router = useRouter();

const form = reactive({ name: '', email: '', password: '', orgName: '' });
const fieldErrors = reactive<FieldErrors>({});
const formError = ref<string | null>(null);
const submitting = ref(false);

function validate(): boolean {
  fieldErrors.name = undefined;
  fieldErrors.email = undefined;
  fieldErrors.password = undefined;
  fieldErrors.orgName = undefined;
  let ok = true;

  if (form.name.trim().length < 2) {
    fieldErrors.name = 'Name must be at least 2 characters';
    ok = false;
  }

  if (!/^\S+@\S+\.\S+$/.test(form.email)) {
    fieldErrors.email = 'Enter a valid email';
    ok = false;
  }

  if (form.password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters';
    ok = false;
  }

  if (form.orgName.trim().length < 2) {
    fieldErrors.orgName = 'Organization name must be at least 2 characters';
    ok = false;
  }

  return ok;
}

async function onSubmit(): Promise<void> {
  formError.value = null;
  if (!validate()) return;

  submitting.value = true;
  try {
    await auth.signup({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      orgName: form.orgName.trim(),
    });
    await router.replace('/app');
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = (err.response?.data as { message?: string } | undefined)?.message;
      formError.value = message ?? 'Sign up failed. Please try again.';
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
      <CardTitle>Create your workspace</CardTitle>
      <CardDescription>Start managing projects with your team.</CardDescription>
    </CardHeader>

    <form @submit.prevent="onSubmit" novalidate>
      <CardContent class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="name">Your name</Label>
          <Input
            id="name"
            v-model="form.name"
            autocomplete="name"
            :aria-invalid="!!fieldErrors.name"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.name" class="text-sm text-destructive">{{ fieldErrors.name }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="orgName">Organization name</Label>
          <Input
            id="orgName"
            v-model="form.orgName"
            autocomplete="organization"
            :aria-invalid="!!fieldErrors.orgName"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.orgName" class="text-sm text-destructive">
            {{ fieldErrors.orgName }}
          </p>
        </div>

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
            autocomplete="new-password"
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
          {{ submitting ? 'Creating account…' : 'Create account' }}
        </Button>
        <p class="text-sm text-muted-foreground">
          Already have an account?
          <RouterLink to="/login" class="underline underline-offset-4">Sign in</RouterLink>
        </p>
      </CardFooter>
    </form>
  </Card>
</template>

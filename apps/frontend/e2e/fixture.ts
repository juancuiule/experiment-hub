import { test as base } from '@playwright/test';
import { ExperimentFlow } from '@experiment-hub/engine/types';

// E2E runs the frontend without apps/backend. Checkpoint POSTs must
// succeed for flows to reach their end state, so every spec intercepts
// /api/** and returns the backend's response shape.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"ok":true}',
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"status":"ok"}',
      });
    });
    await use(page);
  },
});

export const testExperiment: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-consent', type: 'screen', props: { slug: 'consent' } },
    { id: 'screen-personal', type: 'screen', props: { slug: 'personal' } },
    {
      id: 'branch-has-children',
      type: 'branch',
      props: {
        name: 'has-children-branch',
        branches: [
          {
            id: 'yes-children',
            name: 'yes-children',
            config: {
              type: 'simple',
              dataKey: '$$personal.has-children',
              operator: 'eq',
              value: 'yes',
            },
          },
        ],
      },
    },
    { id: 'screen-children', type: 'screen', props: { slug: 'children' } },
    { id: 'screen-done', type: 'screen', props: { slug: 'done' } },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-consent' },
    { type: 'sequential', from: 'screen-consent', to: 'screen-personal' },
    { type: 'sequential', from: 'screen-personal', to: 'branch-has-children' },
    {
      type: 'branch-condition',
      from: 'branch-has-children.yes-children',
      to: 'screen-children',
    },
    {
      type: 'branch-default',
      from: 'branch-has-children',
      to: 'screen-done',
    },
    { type: 'sequential', from: 'screen-children', to: 'screen-done' },
    { type: 'sequential', from: 'screen-done', to: 'end' },
  ],
  screens: [
    {
      slug: 'consent',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '# Test Experiment' },
        },
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            label: 'I agree to participate',
            dataKey: 'consent',
            required: true,
            defaultValue: false,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Start' },
        },
      ],
    },
    {
      slug: 'personal',
      components: [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: 'Do you have children?',
            dataKey: 'has-children',
            required: true,
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$has-children',
              operator: 'eq',
              value: 'yes',
            },
            then: {
              componentFamily: 'response',
              template: 'numeric-input',
              props: {
                label: 'How many children?',
                dataKey: 'num-children',
                required: true,
              },
            },
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Continue' },
        },
      ],
    },
    {
      slug: 'children',
      components: [
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            label: "Children's names",
            dataKey: 'children-names',
            required: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Continue' },
        },
      ],
    },
    {
      slug: 'done',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '# All done!' },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Finish' },
        },
      ],
    },
  ],
};

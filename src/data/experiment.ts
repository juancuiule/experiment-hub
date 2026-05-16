import { ExperimentFlow } from "@/lib/types";

export const experiment: ExperimentFlow = {
  nodes: [
    { id: "start", type: "start" },
    { id: "screen-family", type: "screen", props: { slug: "family" } },
    { id: "screen-welcome", type: "screen", props: { slug: "welcome" } },
    {
      id: "loop-test",
      type: "loop",
      props: {
        type: "static",
        values: ["apple", "banana", "kiwi"],
      },
    },
    {
      id: "inner-loop",
      type: "loop",
      props: {
        type: "static",
        values: ["big", "medium", "small"],
      },
    },
  ],
  edges: [
    { type: "sequential", from: "start", to: "screen-family" },
    { type: "sequential", from: "screen-family", to: "loop-test" },
    { type: "loop-template", from: "loop-test", to: "inner-loop" },
    { type: "loop-template", from: "inner-loop", to: "screen-welcome" },
  ],
  screens: [
    {
      slug: "family",
      components: [
        {
          componentFamily: "content",
          template: "rich-text",
          props: { content: "## General questions about your family" },
        },
        {
          componentFamily: "response",
          template: "radio",
          props: {
            label: "Do you have children?",
            dataKey: "has-children",
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
        },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: {
              type: "simple",
              dataKey: "$has-children",
              operator: "eq",
              value: "yes",
            },
            component: {
              componentFamily: "response",
              template: "numeric-input",
              props: {
                label: "How many children do you have?",
                dataKey: "number-of-children",
              },
            },
          },
        },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: {
              type: "simple",
              dataKey: "$has-children",
              operator: "eq",
              value: "no",
            },
            component: {
              componentFamily: "response",
              template: "radio",
              props: {
                label: "Would you like to have children in the future?",
                dataKey: "wants-children",
                options: [
                  { label: "Yes", value: "yes" },
                  { label: "No", value: "no" },
                ],
              },
            },
          },
        },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: {
              type: "simple",
              dataKey: "$wants-children",
              operator: "eq",
              value: "yes",
            },
            component: {
              componentFamily: "response",
              template: "numeric-input",
              props: {
                label: "How many children would you like to have?",
                dataKey: "desired-number-of-children",
              },
            },
          },
        },
        {
          componentFamily: "layout",
          template: "button",
          props: {
            text: "Continue",
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: "welcome",
      components: [
        {
          componentFamily: "content",
          template: "image",
          props: {
            url: "/fruits/{{@loop-test.value}}.png",
            alt: "{{@loop-test.value}} image",
            className: "w-16 mx-auto",
          },
        },
        {
          componentFamily: "content",
          template: "rich-text",
          props: {
            content:
              "## Welcome ({{@inner-loop.value}} {{@loop-test.value}}) \n Lorem ipsum  dolor sit amet, consectetur adipiscing elit. Proin quis elit lacus. Pellentesque auctor pharetra enim in commodo. Etiam tincidunt maximus ante, a varius eros posuere eget. Vestibulum sed ultricies urna. Duis suscipit interdum eros, et semper ante. Pellentesque sed elementum justo.",
          },
        },
        {
          componentFamily: "response",
          template: "checkboxes",
          props: {
            label: "Select **your** `favorite` {{@loop-test.value}} varieties",
            dataKey: "favorite-varieties",
            randomize: true,
            options: [
              { label: "Variety 1", value: "variety-1" },
              { label: "Variety 2", value: "variety-2" },
              { label: "Variety 3", value: "variety-3" },
            ],
          },
        },
        {
          componentFamily: "control",
          template: "for-each",
          props: {
            id: "for-each-favorite-variety",
            type: "dynamic",
            dataKey: "$favorite-varieties",
            component: {
              componentFamily: "layout",
              template: "group",
              props: {
                name: "favorite-variety-{{#for-each-favorite-variety.index}}",
                components: [
                  {
                    componentFamily: "content",
                    template: "rich-text",
                    props: {
                      content:
                        "- You selected **{{#for-each-favorite-variety.value}}** as one of your favorite {{@loop-test.value}} varieties",
                    },
                  },
                  {
                    componentFamily: "response",
                    template: "radio",
                    props: {
                      label:
                        "Would you recommend {{#for-each-favorite-variety.value}} to a friend?",
                      dataKey: "recommend-{{#for-each-favorite-variety.value}}",
                      options: [
                        { label: "Yes", value: "yes" },
                        { label: "No", value: "no" },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
        {
          componentFamily: "layout",
          template: "button",
          props: {
            text: "Continue",
            alignBottom: true,
          },
        },
      ],
    },
  ],
};

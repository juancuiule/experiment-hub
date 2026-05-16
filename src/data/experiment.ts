import { ExperimentFlow } from "@/lib/types";

export const experiment: ExperimentFlow = {
  nodes: [
    { id: "start", type: "start" },
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
    { type: "sequential", from: "start", to: "loop-test" },
    { type: "loop-template", from: "loop-test", to: "inner-loop" },
    { type: "loop-template", from: "inner-loop", to: "screen-welcome" },
  ],
  screens: [
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

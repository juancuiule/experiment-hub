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
        values: ["apple", "banana", "orange"],
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
            options: [
              { label: "Variety 1", value: "variety-1" },
              { label: "Variety 2", value: "variety-2" },
              { label: "Variety 3", value: "variety-3" },
            ],
          },
        },
        // {
        //   componentFamily: "control",
        //   template: "for-each",
        //   props: {
        //     type: "static",
        //     values: ["futbol", "tenis"],
        //     id: "foreachSport",
        //     component: {
        //       componentFamily: "control",
        //       template: "for-each",
        //       props: {
        //         type: "static",
        //         id: "innerForEach",
        //         values: ["nested1", "nested2"],
        //         component: {
        //           componentFamily: "content",
        //           template: "rich-text",
        //           props: {
        //             content:
        //               "I like {{#foreachSport.value}} {{#innerForEach.value}}",
        //           },
        //         },
        //       },
        //     },
        //   },
        // },
        {
          componentFamily: "response",
          template: "slider",
          props: {
            label: "Drag the slider {{$mood}} indicate how you're feeling today",
            min: 0,
            max: 100,
            dataKey: "mood",
          },
        },
        {
          componentFamily: "response",
          template: "single-checkbox",
          props: {
            label: "I have read and understood the instructions",
            dataKey: "consent",
            defaultValue: false,
          },
        },
        {
          componentFamily: "response",
          template: "text-input",
          props: {
            label: "What's on your mind?",
            placeholder: "Type {{$mood}} something here...",
            dataKey: "thoughts",
          },
        },
        {
          componentFamily: "response",
          template: "text-area",
          props: {
            label: "Any additional comments?",
            placeholder: "Type something here...",
            dataKey: "comments",
            lines: 2,
          },
        },
        {
          componentFamily: "response",
          template: "date-input",
          props: {
            label: "Select your date of birth",
            dataKey: "date-of-birth",
          },
        },
        {
          componentFamily: "response",
          template: "time-input",
          props: {
            label: "Select your preferred contact time",
            dataKey: "contact-time",
          },
        },
        {
          componentFamily: "response",
          template: "dropdown",
          props: {
            label: "Select your favorite fruit",
            dataKey: "favorite-fruit",
            options: [
              { label: "Apple", value: "apple" },
              { label: "Banana", value: "banana" },
              { label: "Cherry", value: "cherry" },
            ],
          },
        },
        {
          componentFamily: "response",
          template: "radio",
          props: {
            label: "Select your gender",
            dataKey: "gender",
            options: [
              { label: "Male", value: "male" },
              { label: "Female", value: "female" },
              { label: "Other", value: "other" },
            ],
          },
        },
        {
          componentFamily: "response",
          template: "checkboxes",
          props: {
            label: "Select your hobbies",
            dataKey: "hobbies",
            options: [
              { label: "Reading", value: "reading" },
              { label: "Traveling", value: "traveling" },
              { label: "Cooking", value: "cooking" },
            ],
          },
        },
        {
          componentFamily: "response",
          template: "numeric-input",
          props: {
            label: "How many hours do you sleep on average?",
            dataKey: "sleep-hours",
            min: 0,
            max: 24,
          },
        },
        {
          componentFamily: "response",
          template: "likert-scale",
          props: {
            label: "How satisfied are you with our service?",
            dataKey: "satisfaction",
            options: [
              { label: "Very Unsatisfied", value: "1" },
              { label: "", value: "2" },
              { label: "Neutral", value: "3" },
              { label: "", value: "4" },
              { label: "Very Satisfied", value: "5" },
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

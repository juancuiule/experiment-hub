import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Screen } from '../Screen';
import { FrameworkScreen } from '@/lib/screen';

const noop = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  noop.mockClear();
});

function renderScreen(
  components: FrameworkScreen['components'],
  context = {},
  onNext = noop,
) {
  return render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={false}
      onNext={onNext}
      context={context}
    />,
  );
}

describe('rendering', () => {
  it('renders an input with its label', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'text-input',
        props: { dataKey: 'name', label: 'Your name' },
      },
    ]);
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  });

  it('renders a checkbox group with all options', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'checkboxes',
        props: {
          dataKey: 'hobbies',
          label: 'Hobbies',
          options: [
            { label: 'Reading', value: 'reading' },
            { label: 'Cooking', value: 'cooking' },
          ],
        },
      },
    ]);
    expect(screen.getByLabelText('Reading')).toBeInTheDocument();
    expect(screen.getByLabelText('Cooking')).toBeInTheDocument();
  });

  it('renders a likert-scale with the correct number of options', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'likert-scale',
        props: {
          dataKey: 'score',
          label: 'Score',
          options: [
            { label: 'Strongly disagree', value: '1' },
            { label: 'Disagree', value: '2' },
            { label: 'Neutral', value: '3' },
            { label: 'Agree', value: '4' },
            { label: 'Strongly agree', value: '5' },
          ],
        },
      },
    ]);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('renders rich-text markdown as HTML', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'rich-text',
        props: { content: '## Hello world' },
      },
    ]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Hello world' }),
    ).toBeInTheDocument();
  });

  it('renders a button', () => {
    renderScreen([
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });
});

describe('label interpolation', () => {
  it('replaces @value in labels with currentItem.value from context', () => {
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'enjoyment',
            label: 'How much do you enjoy {{@loop-1.value}}?',
            options: [
              { label: 'A lot', value: '1' },
              { label: 'A little', value: '2' },
            ],
          },
        },
      ],
      { loopData: { 'loop-1': { value: 'soccer', index: 0 } } },
    );
    expect(
      screen.getByText('How much do you enjoy soccer?'),
    ).toBeInTheDocument();
  });

  it('replaces $$ references in labels with context.data values', () => {
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'note', label: 'Hi {{$$welcome.name}}!' },
        },
      ],
      { data: { welcome: { name: 'Juan' } } },
    );
    expect(screen.getByLabelText('Hi Juan!')).toBeInTheDocument();
  });

  it('replaces @value in rich-text content', () => {
    renderScreen(
      [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '## {{@loop-1.value}}' },
        },
      ],
      { loopData: { 'loop-1': { value: 'cooking', index: 1 } } },
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'cooking' }),
    ).toBeInTheDocument();
  });

  it('resolves @value in radio option labels', () => {
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'rating',
            label: 'Rating',
            options: [
              { label: 'I enjoy {{@loop-1.value}}', value: 'yes' },
              { label: "I don't enjoy {{@loop-1.value}}", value: 'no' },
            ],
          },
        },
      ],
      { loopData: { 'loop-1': { value: 'running', index: 0 } } },
    );
    expect(screen.getByLabelText('I enjoy running')).toBeInTheDocument();
    expect(screen.getByLabelText("I don't enjoy running")).toBeInTheDocument();
  });

  it('resolves $$ references in checkboxes option labels', () => {
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'picks',
            label: 'Picks',
            options: [
              { label: "{{$$user.name}}'s pick", value: 'a' },
              { label: 'Other', value: 'b' },
            ],
          },
        },
      ],
      { data: { user: { name: 'Juan' } } },
    );
    expect(screen.getByLabelText("Juan's pick")).toBeInTheDocument();
  });

  it('resolves $$ references in text-input placeholder', () => {
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            dataKey: 'note',
            label: 'Note',
            placeholder: "e.g. describe {{$$welcome.name}}'s experience",
          },
        },
      ],
      { data: { welcome: { name: 'Maria' } } },
    );
    expect(
      screen.getByPlaceholderText("e.g. describe Maria's experience"),
    ).toBeInTheDocument();
  });

  it('resolves @value in button text', () => {
    renderScreen(
      [
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Continue to {{@loop-1.value}}' },
        },
      ],
      { loopData: { 'loop-1': { value: 'section 2', index: 1 } } },
    );
    expect(
      screen.getByRole('button', { name: 'Continue to section 2' }),
    ).toBeInTheDocument();
  });

  it('resolves interpolation in image alt text', () => {
    renderScreen(
      [
        {
          componentFamily: 'content',
          template: 'image',
          props: {
            url: 'https://example.com/cat.png',
            alt: 'Photo of {{$$user.name}}',
          },
        },
      ],
      { data: { user: { name: 'Juan' } } },
    );
    expect(
      screen.getByRole('img', { name: 'Photo of Juan' }),
    ).toBeInTheDocument();
  });

  it('resolves interpolation in image src when URL is safe', () => {
    renderScreen(
      [
        {
          componentFamily: 'content',
          template: 'image',
          props: {
            url: 'https://cdn.example.com/{{@loop-1.value}}.png',
            alt: 'Loop image',
          },
        },
      ],
      { loopData: { 'loop-1': { value: 'cat', index: 0 } } },
    );
    expect(screen.getByRole('img', { name: 'Loop image' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/cat.png',
    );
  });

  it('blocks interpolation in image src for unsafe URL schemes', () => {
    renderScreen(
      [
        {
          componentFamily: 'content',
          template: 'image',
          props: { url: '{{$$image.url}}', alt: 'Unsafe image' },
        },
      ],
      { data: { image: { url: 'javascript:alert(1)' } } },
    );
    expect(
      screen.getByRole('img', { name: 'Unsafe image' }),
    ).not.toHaveAttribute('src');
  });
});

describe('validation', () => {
  it('blocks submit and shows error when a required input is empty', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'name', label: 'Name', required: true },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('blocks submit and shows error when a required checkbox-group has nothing selected', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'activities',
            label: 'Activities',
            required: true,
            options: [{ label: 'Exercise', value: 'exercise' }],
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).not.toHaveBeenCalled();
    expect(
      screen.getByText('Please select at least one option'),
    ).toBeInTheDocument();
  });

  it('blocks submit and shows error when a required likert-scale is not selected', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'score',
            label: 'Score',
            options: [
              { label: 'Agree', value: '1' },
              { label: 'Disagree', value: '2' },
            ],
            required: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('does not block submit for optional fields left empty', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'note', label: 'Optional note', required: false },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalled();
  });
});

describe('data collection', () => {
  it('calls onNext with input value', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'name', label: 'Name', required: true },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.type(screen.getByLabelText('Name'), 'Juan');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ name: 'Juan' });
  });

  it('calls onNext with selected checkbox values as array', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'activities',
            label: 'Activities',
            required: true,
            options: [
              { label: 'Reading', value: 'reading' },
              { label: 'Cooking', value: 'cooking' },
            ],
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.click(screen.getByLabelText('Reading'));
    await userEvent.click(screen.getByLabelText('Cooking'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ activities: ['reading', 'cooking'] });
  });

  it('calls onNext with selected likert-scale value', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'score',
            label: 'Score',
            options: [
              { label: 'Strongly disagree', value: '1' },
              { label: 'Disagree', value: '2' },
              { label: 'Neutral', value: '3' },
              { label: 'Agree', value: '4' },
              { label: 'Strongly agree', value: '5' },
            ],
            required: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );

    await userEvent.click(screen.getByRole('radio', { name: '3 — Neutral' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ score: '3' });
  });
});

describe('conditional', () => {
  const components: FrameworkScreen['components'] = [
    {
      componentFamily: 'response',
      template: 'radio',
      props: {
        dataKey: 'has-children',
        label: 'Do you have children?',
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
        component: {
          componentFamily: 'response',
          template: 'numeric-input',
          props: {
            label: 'How many children do you have?',
            dataKey: 'number-of-children',
          },
        },
      },
    },
    {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Submit' },
    },
  ];

  it('hides the conditional field by default', () => {
    renderScreen(components);
    expect(
      screen.queryByLabelText('How many children do you have?'),
    ).not.toBeInTheDocument();
  });

  it('shows the conditional field when the condition is met', async () => {
    renderScreen(components);
    await userEvent.click(screen.getByLabelText('Yes'));
    expect(
      screen.getByLabelText('How many children do you have?'),
    ).toBeInTheDocument();
  });

  it('hides the conditional field again when the condition is no longer met', async () => {
    renderScreen(components);
    await userEvent.click(screen.getByLabelText('Yes'));
    await userEvent.click(screen.getByLabelText('No'));
    expect(
      screen.queryByLabelText('How many children do you have?'),
    ).not.toBeInTheDocument();
  });

  it('does not submit the conditional field when condition is no longer met', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(components, {}, onNext);

    await userEvent.click(screen.getByLabelText('Yes'));
    await userEvent.type(
      screen.getByLabelText('How many children do you have?'),
      '20',
    );
    await userEvent.click(screen.getByLabelText('No'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ 'has-children': 'no' });
    expect(onNext).not.toHaveBeenCalledWith(
      expect.objectContaining({ 'number-of-children': expect.anything() }),
    );
  });

  it('submits the conditional field value when condition is met', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(components, {}, onNext);

    await userEvent.click(screen.getByLabelText('Yes'));
    await userEvent.type(
      screen.getByLabelText('How many children do you have?'),
      '3',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({
      'has-children': 'yes',
      'number-of-children': 3,
    });
  });
});

describe('randomize options', () => {
  function shuffledContext(
    dataKey: string,
    order: Array<{ label: string; value: string }>,
  ) {
    return { screenData: { shuffledOptions: { [dataKey]: order } } };
  }

  it('renders radio options in the order provided by context.screenData.shuffledOptions', () => {
    const shuffled = [
      { label: 'C', value: 'c' },
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ];
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
              { label: 'C', value: 'c' },
            ],
            randomize: true,
          },
        },
      ],
      shuffledContext('choice', shuffled),
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('id', 'choice-c');
    expect(radios[1]).toHaveAttribute('id', 'choice-a');
    expect(radios[2]).toHaveAttribute('id', 'choice-b');
  });

  it('submits value AND :order when radio has randomize:true', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    const shuffled = [
      { label: 'B', value: 'b' },
      { label: 'A', value: 'a' },
    ];
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
            randomize: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      shuffledContext('choice', shuffled),
      onNext,
    );
    await userEvent.click(screen.getByLabelText('A'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onNext).toHaveBeenCalledWith({
      choice: 'a',
      'choice:order': ['b', 'a'],
    });
  });

  it('does not include :order when radio has no randomize prop', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: [{ label: 'A', value: 'a' }],
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      {},
      onNext,
    );
    await userEvent.click(screen.getByLabelText('A'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onNext).toHaveBeenCalledWith({ choice: 'a' });
    expect(onNext).not.toHaveBeenCalledWith(
      expect.objectContaining({ 'choice:order': expect.anything() }),
    );
  });

  it('submits values AND :order when checkboxes has randomize:true', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    const shuffled = [
      { label: 'B', value: 'b' },
      { label: 'A', value: 'a' },
    ];
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'picks',
            label: 'Picks',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
            randomize: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Submit' },
        },
      ],
      shuffledContext('picks', shuffled),
      onNext,
    );
    await userEvent.click(screen.getByLabelText('A'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onNext).toHaveBeenCalledWith({
      picks: ['a'],
      'picks:order': ['b', 'a'],
    });
  });

  it('picks up new :order defaults when remounted with different shuffledOptions (loop iteration)', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    const components: FrameworkScreen['components'] = [
      {
        componentFamily: 'response',
        template: 'radio',
        props: {
          dataKey: 'choice',
          label: 'Choice',
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
          randomize: true,
        },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ];

    const { unmount } = render(
      <Screen
        screen={{ slug: 'test', components }}
        isLoading={false}
        onNext={onNext}
        context={shuffledContext('choice', [
          { label: 'B', value: 'b' },
          { label: 'A', value: 'a' },
        ])}
      />,
    );

    await userEvent.click(screen.getByLabelText('A'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onNext).toHaveBeenNthCalledWith(1, {
      choice: 'a',
      'choice:order': ['b', 'a'],
    });

    // Simulate key-based remount that Experiment.tsx triggers on loop iteration change
    unmount();
    render(
      <Screen
        screen={{ slug: 'test', components }}
        isLoading={false}
        onNext={onNext}
        context={shuffledContext('choice', [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ])}
      />,
    );

    await userEvent.click(screen.getByLabelText('A'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onNext).toHaveBeenNthCalledWith(2, {
      choice: 'a',
      'choice:order': ['a', 'b'],
    });
  });
});

// ---------------------------------------------------------------------------
// For-each
// ---------------------------------------------------------------------------

describe('for-each', () => {
  const components: FrameworkScreen['components'] = [
    {
      componentFamily: 'response',
      template: 'checkboxes',
      props: {
        dataKey: 'selected-varieties',
        label: 'Select varieties',
        options: [
          { label: 'Variety 1', value: 'variety-1' },
          { label: 'Variety 2', value: 'variety-2' },
          { label: 'Variety 3', value: 'variety-3' },
        ],
      },
    },
    {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        id: 'for-each-variety',
        type: 'dynamic',
        dataKey: '$selected-varieties',
        component: {
          componentFamily: 'layout',
          template: 'group',
          props: {
            name: 'variety-group-{{#for-each-variety.index}}',
            components: [
              {
                componentFamily: 'response',
                template: 'radio',
                props: {
                  label: 'Recommend {{#for-each-variety.value}}?',
                  dataKey: 'recommend-{{#for-each-variety.value}}',
                  options: [
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                  ],
                },
              },
            ],
          },
        },
      },
    },
    {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Submit' },
    },
  ];

  it('renders a radio group for each selected checkbox item', async () => {
    renderScreen(components);
    await userEvent.click(screen.getByLabelText('Variety 1'));
    await userEvent.click(screen.getByLabelText('Variety 2'));
    expect(screen.getByText('Recommend variety-1?')).toBeInTheDocument();
    expect(screen.getByText('Recommend variety-2?')).toBeInTheDocument();
    expect(screen.queryByText('Recommend variety-3?')).not.toBeInTheDocument();
  });

  it('removes a radio group when its checkbox is deselected', async () => {
    renderScreen(components);
    await userEvent.click(screen.getByLabelText('Variety 1'));
    await userEvent.click(screen.getByLabelText('Variety 2'));
    await userEvent.click(screen.getByLabelText('Variety 1'));
    expect(screen.queryByText('Recommend variety-1?')).not.toBeInTheDocument();
    expect(screen.getByText('Recommend variety-2?')).toBeInTheDocument();
  });

  it('collects radio values for each foreach iteration on submit', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(components, {}, onNext);

    await userEvent.click(screen.getByLabelText('Variety 1'));
    await userEvent.click(screen.getByLabelText('Variety 2'));

    const [yesForVariety1, yesForVariety2] = screen.getAllByRole('radio', {
      name: 'Yes',
    });
    await userEvent.click(yesForVariety1);
    await userEvent.click(yesForVariety2);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({
      'selected-varieties': ['variety-1', 'variety-2'],
      'recommend-variety-1': 'yes',
      'recommend-variety-2': 'yes',
    });
  });

  it('does not submit radio values for deselected checkbox items', async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    renderScreen(components, {}, onNext);

    await userEvent.click(screen.getByLabelText('Variety 1'));
    await userEvent.click(screen.getByLabelText('Variety 2'));
    await userEvent.click(screen.getByLabelText('Variety 1'));

    const [yesForVariety2] = screen.getAllByRole('radio', { name: 'Yes' });
    await userEvent.click(yesForVariety2);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({
      'selected-varieties': ['variety-2'],
      'recommend-variety-2': 'yes',
    });
    expect(onNext).not.toHaveBeenCalledWith(
      expect.objectContaining({ 'recommend-variety-1': expect.anything() }),
    );
  });
});

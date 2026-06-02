import { describe, expect, it } from 'vitest';
import {
  getPath,
  getPrefixAndPath,
  getValue,
  resolveInterpolatedImageUrl,
  resolveLikertOptionsSource,
  resolveOptionsSource,
  resolveValuesInString,
} from '../resolve';

describe('resolveOptionsSource', () => {
  const sharedOptions = {
    'yes-no': [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
  };

  it('returns the array unchanged when options is Option[]', () => {
    const opts = [{ label: 'A', value: 'a' }];
    expect(resolveOptionsSource(opts, {})).toEqual(opts);
  });

  it('resolves %name to the named shared option set', () => {
    expect(resolveOptionsSource('%yes-no', {}, sharedOptions)).toEqual([
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ]);
  });

  it('returns [] when %name does not exist in sharedOptions', () => {
    expect(resolveOptionsSource('%missing', {}, sharedOptions)).toEqual([]);
  });

  it('returns [] when sharedOptions is undefined and options is %name', () => {
    expect(resolveOptionsSource('%yes-no', {})).toEqual([]);
  });

  it('resolves a data-key source into an Option[]', () => {
    const ctx = {
      data: {
        choices: [
          { label: 'One', value: '1' },
          { label: 'Two', value: '2' },
        ],
      },
    };
    expect(resolveOptionsSource('$$choices', ctx)).toEqual([
      { label: 'One', value: '1' },
      { label: 'Two', value: '2' },
    ]);
  });

  it('maps a data-key array of strings into {label, value} pairs', () => {
    const ctx = { data: { fruits: ['apple', 'pear'] } };
    expect(resolveOptionsSource('$$fruits', ctx)).toEqual([
      { label: 'apple', value: 'apple' },
      { label: 'pear', value: 'pear' },
    ]);
  });

  it('returns [] when the data-key source does not resolve to an array', () => {
    const ctx = { data: { notList: 'scalar' } };
    expect(resolveOptionsSource('$$notList', ctx)).toEqual([]);
  });
});

describe('resolveInterpolatedImageUrl', () => {
  it('returns an absolute http(s) URL unchanged', () => {
    expect(resolveInterpolatedImageUrl('https://x.com/a.png', {})).toBe(
      'https://x.com/a.png',
    );
  });

  it('interpolates tokens before validating the URL', () => {
    const ctx = { data: { id: '42' } };
    expect(resolveInterpolatedImageUrl('https://x.com/{{$$id}}.png', ctx)).toBe(
      'https://x.com/42.png',
    );
  });

  it('returns a root-relative path unchanged', () => {
    expect(resolveInterpolatedImageUrl('/img/a.png', {})).toBe('/img/a.png');
  });

  it('returns a ./ relative path unchanged', () => {
    expect(resolveInterpolatedImageUrl('./a.png', {})).toBe('./a.png');
  });

  it('returns null for a protocol-relative // URL', () => {
    expect(resolveInterpolatedImageUrl('//x.com/a.png', {})).toBeNull();
  });

  it('returns null for an empty / unresolved template', () => {
    expect(resolveInterpolatedImageUrl('', {})).toBeNull();
  });

  it('returns null for a non-http protocol', () => {
    expect(resolveInterpolatedImageUrl('javascript:alert(1)', {})).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(resolveInterpolatedImageUrl('not a url', {})).toBeNull();
  });
});

describe('getPath', () => {
  it('reads a nested value via dot notation', () => {
    expect(getPath('a.b.c', { a: { b: { c: 7 } } })).toBe(7);
  });

  it('returns undefined when an intermediate segment is missing', () => {
    expect(getPath('a.b.c', { a: {} })).toBeUndefined();
  });
});

describe('getPrefixAndPath', () => {
  it('parses prefix and path from a reference', () => {
    expect(getPrefixAndPath('$$profile.age')).toMatchObject({
      path: 'profile.age',
    });
  });

  it('returns null for a string with no recognized prefix', () => {
    expect(getPrefixAndPath('plain')).toBeNull();
  });
});

describe('getValue — error and foreach paths', () => {
  it('throws when the resolved key has no valid prefix', () => {
    expect(() => getValue('plain', {})).toThrow('Invalid key format');
  });

  it('resolves a # foreach reference from screenData.foreachData', () => {
    const ctx = {
      screenData: { foreachData: { fe: { value: 'tennis', index: 0 } } },
    };
    expect(getValue('#fe.value', ctx)).toBe('tennis');
  });
});

describe('resolveLikertOptionsSource', () => {
  const sharedOptions = {
    agreement: [
      { label: 'Strongly disagree', value: '1' },
      { label: 'Strongly agree', value: '5' },
    ],
  };

  it('returns the array unchanged when options is LikertOption[]', () => {
    const opts = [{ value: '1' }, { value: '2', label: 'Two' }];
    expect(resolveLikertOptionsSource(opts)).toEqual(opts);
  });

  it('resolves %name from sharedOptions', () => {
    expect(resolveLikertOptionsSource('%agreement', sharedOptions)).toEqual([
      { label: 'Strongly disagree', value: '1' },
      { label: 'Strongly agree', value: '5' },
    ]);
  });

  it('returns [] when %name is not found', () => {
    expect(resolveLikertOptionsSource('%missing', sharedOptions)).toEqual([]);
  });

  it('returns [] when sharedOptions is undefined', () => {
    expect(resolveLikertOptionsSource('%agreement')).toEqual([]);
  });
});

describe('resolveValuesInString', () => {
  describe('@ references (loopData)', () => {
    it('replaces {{@loopId.value}} with the current loop item value', () => {
      const ctx = {
        loopData: { 'loop-sports': { value: 'soccer', index: 0 } },
      };
      expect(resolveValuesInString('I like {{@loop-sports.value}}', ctx)).toBe(
        'I like soccer',
      );
    });

    it('replaces {{@loopId.index}} with the current loop item index', () => {
      const ctx = { loopData: { 'loop-sports': { value: 'x', index: 2 } } };
      expect(resolveValuesInString('Item {{@loop-sports.index}}', ctx)).toBe(
        'Item 2',
      );
    });

    it('replaces {{@loopId.index}} when index is 0 (does not leave token)', () => {
      const ctx = { loopData: { 'loop-sports': { value: 'x', index: 0 } } };
      expect(resolveValuesInString('Item {{@loop-sports.index}}', ctx)).toBe(
        'Item 0',
      );
    });

    it('leaves the token as-is when loopData for that id is undefined', () => {
      expect(resolveValuesInString('Hello {{@loop-sports.value}}', {})).toBe(
        'Hello {{@loop-sports.value}}',
      );
    });

    it('replaces multiple @ tokens in one string', () => {
      const ctx = { loopData: { 'loop-sports': { value: 'chess', index: 0 } } };
      expect(
        resolveValuesInString(
          '{{@loop-sports.value}} and {{@loop-sports.value}}',
          ctx,
        ),
      ).toBe('chess and chess');
    });

    it('resolves tokens for different loop ids independently', () => {
      const ctx = {
        loopData: {
          'loop-sports': { value: 'football', index: 0 },
          'loop-colors': { value: 'red', index: 1 },
        },
      };
      expect(
        resolveValuesInString(
          '{{@loop-sports.value}} / {{@loop-colors.value}}',
          ctx,
        ),
      ).toBe('football / red');
    });
  });

  describe('# references (foreachData)', () => {
    it('replaces {{#foreachId.value}} with the foreach item value', () => {
      const ctx = {
        screenData: {
          foreachData: { 'foreach-sport': { value: 'tennis', index: 0 } },
        },
      };
      expect(
        resolveValuesInString('Sport: {{#foreach-sport.value}}', ctx),
      ).toBe('Sport: tennis');
    });

    it('replaces {{#foreachId.index}} with the foreach item index', () => {
      const ctx = {
        screenData: {
          foreachData: { 'foreach-sport': { value: 'tennis', index: 3 } },
        },
      };
      expect(
        resolveValuesInString('Index: {{#foreach-sport.index}}', ctx),
      ).toBe('Index: 3');
    });

    it('leaves the token as-is when foreachData is undefined', () => {
      expect(resolveValuesInString('{{#foreach-sport.value}}', {})).toBe(
        '{{#foreach-sport.value}}',
      );
    });
  });

  describe('$$ references (context.data)', () => {
    it('replaces {{$$key}} with the value from context.data', () => {
      const ctx = { data: { welcome: { name: 'Juan' } } };
      expect(resolveValuesInString('Hi {{$$welcome.name}}!', ctx)).toBe(
        'Hi Juan!',
      );
    });

    it('resolves deeply nested paths', () => {
      const ctx = { data: { a: { b: { c: 'deep' } } } };
      expect(resolveValuesInString('{{$$a.b.c}}', ctx)).toBe('deep');
    });

    it('resolves hyphenated keys in the path', () => {
      const ctx = { data: { 'prayer-frequency': 'daily' } };
      expect(
        resolveValuesInString('Frequency: {{$$prayer-frequency}}', ctx),
      ).toBe('Frequency: daily');
    });

    it('resolves hyphenated segments in a dotted path', () => {
      const ctx = { data: { survey: { 'follow-up': 'yes' } } };
      expect(resolveValuesInString('{{$$survey.follow-up}}', ctx)).toBe('yes');
    });

    it('leaves the token as-is when the path does not resolve', () => {
      const ctx = { data: { welcome: {} } };
      expect(resolveValuesInString('Hi {{$$welcome.name}}', ctx)).toBe(
        'Hi {{$$welcome.name}}',
      );
    });

    it('leaves the token as-is when context.data is undefined', () => {
      expect(resolveValuesInString('{{$$foo.bar}}', {})).toBe('{{$$foo.bar}}');
    });

    it('resolves multiple distinct $$ tokens in one string', () => {
      const ctx = { data: { a: { x: 'foo' }, b: { y: 'bar' } } };
      expect(resolveValuesInString('{{$$a.x}} and {{$$b.y}}', ctx)).toBe(
        'foo and bar',
      );
    });
  });

  describe('$ references (context.screenData)', () => {
    it('replaces {{$key}} with the value from context.screenData', () => {
      const ctx = { screenData: { slider: 5 } };
      expect(resolveValuesInString('Value: {{$slider}}', ctx)).toBe('Value: 5');
    });

    it('leaves the token as-is when the path does not resolve', () => {
      expect(resolveValuesInString('{{$missing}}', {})).toBe('{{$missing}}');
    });
  });

  describe('mixed references', () => {
    it('resolves both @ and $$ tokens in the same string', () => {
      const ctx = {
        data: { welcome: { name: 'Juan' } },
        loopData: { 'loop-sports': { value: 'soccer', index: 0 } },
      };
      expect(
        resolveValuesInString(
          '{{$$welcome.name}} likes {{@loop-sports.value}}',
          ctx,
        ),
      ).toBe('Juan likes soccer');
    });

    it('resolves both $$ and $ tokens in the same string', () => {
      const ctx = {
        data: { welcome: { name: 'Juan' } },
        screenData: { age: 30 },
      };
      expect(resolveValuesInString('{{$$welcome.name}} is {{$age}}', ctx)).toBe(
        'Juan is 30',
      );
    });
  });

  describe('nested templates', () => {
    it('resolves a # index nested inside a $$ path', () => {
      const ctx = {
        screenData: {
          foreachData: { 'for-each-mirada': { index: 0, value: 'mirada-a' } },
        },
        data: { 'loop-miradas': { '0': { mirada: { answer: 'ashamed' } } } },
      };
      expect(
        resolveValuesInString(
          'Tu respuesta: {{$$loop-miradas.{{#for-each-mirada.index}}.mirada.answer}}',
          ctx,
        ),
      ).toBe('Tu respuesta: ashamed');
    });

    it('resolves a @ index nested inside a $$ path', () => {
      const ctx = {
        loopData: { 'loop-items': { value: 'sports', index: 1 } },
        data: { answers: { '1': { value: 'football' } } },
      };
      expect(
        resolveValuesInString('{{$$answers.{{@loop-items.index}}.value}}', ctx),
      ).toBe('football');
    });

    it('leaves the outer token as-is when the inner token does not resolve', () => {
      const ctx = { data: { answers: { '0': { value: 'x' } } } };
      expect(
        resolveValuesInString('{{$$answers.{{#foreach.index}}.value}}', ctx),
      ).toBe('{{$$answers.{{#foreach.index}}.value}}');
    });

    it('handles a nested token alongside a simple token in the same string', () => {
      const ctx = {
        screenData: { foreachData: { fe: { index: 2, value: 'c' } } },
        data: { rows: { '2': { label: 'row-c' } }, title: 'Results' },
      };
      expect(
        resolveValuesInString(
          '{{$$title}}: {{$$rows.{{#fe.index}}.label}}',
          ctx,
        ),
      ).toBe('Results: row-c');
    });
  });

  describe('edge cases', () => {
    it('returns the string unchanged when there are no tokens', () => {
      expect(resolveValuesInString('No tokens here', {})).toBe(
        'No tokens here',
      );
    });

    it('converts non-string resolved values to string', () => {
      const ctx = { loopData: { 'loop-scores': { value: 42, index: 0 } } };
      expect(resolveValuesInString('Score: {{@loop-scores.value}}', ctx)).toBe(
        'Score: 42',
      );
    });
  });

  describe('depth guard', () => {
    it('returns text unchanged when _depth exceeds 10', () => {
      const ctx = { data: { key: 'value' } };
      expect(resolveValuesInString('{{$$key}}', ctx, 11)).toBe('{{$$key}}');
    });

    it('normal resolution still works at depth 0', () => {
      const ctx = { data: { name: 'Alice' } };
      expect(resolveValuesInString('Hello {{$$name}}', ctx, 0)).toBe(
        'Hello Alice',
      );
    });

    it('does not stack overflow when a resolved value contains a template reference', () => {
      // context.data.a resolves to "{{$$b}}", which itself resolves to "world"
      const ctx = { data: { a: '{{$$b}}', b: 'world' } };
      expect(() => resolveValuesInString('{{$$a}}', ctx)).not.toThrow();
    });

    it('leaves tokens as-is when a self-referential cycle would otherwise overflow', () => {
      // context.data.loop resolves to "{{$$loop}}" — a direct self-reference
      const ctx = { data: { loop: '{{$$loop}}' } };
      expect(() => resolveValuesInString('{{$$loop}}', ctx)).not.toThrow();
    });
  });

  describe('[[ ]] dictionary references (context.messages)', () => {
    it('replaces [[key]] with the matching message', () => {
      const ctx = { messages: { greeting: 'Hola' } };
      expect(resolveValuesInString('[[greeting]] mundo', ctx)).toBe(
        'Hola mundo',
      );
    });

    it('replaces multiple [[ ]] tokens in one string', () => {
      const ctx = { messages: { greeting: 'Hola', cta: 'Continuar' } };
      expect(resolveValuesInString('[[greeting]] — [[cta]]', ctx)).toBe(
        'Hola — Continuar',
      );
    });

    it('supports dotted and hyphenated keys', () => {
      const ctx = { messages: { 'welcome.title': 'Bienvenido' } };
      expect(resolveValuesInString('[[welcome.title]]', ctx)).toBe(
        'Bienvenido',
      );
    });

    it('leaves the token literal when the key is missing', () => {
      const ctx = { messages: { greeting: 'Hola' } };
      expect(resolveValuesInString('[[missing]]', ctx)).toBe('[[missing]]');
    });

    it('leaves the token literal when there are no messages at all', () => {
      expect(resolveValuesInString('[[greeting]]', {})).toBe('[[greeting]]');
    });

    it('resolves {{ }} answer-piping inside a dictionary message', () => {
      const ctx = {
        messages: { greeting: 'Hola {{$$welcome.name}}' },
        data: { welcome: { name: 'Ana' } },
      };
      expect(resolveValuesInString('[[greeting]]', ctx)).toBe('Hola Ana');
    });

    it('resolves nested [[ ]] inside a dictionary message', () => {
      const ctx = {
        messages: {
          intro: 'Bienvenido, [[greeting]]',
          greeting: 'hola',
        },
      };
      expect(resolveValuesInString('[[intro]]', ctx)).toBe('Bienvenido, hola');
    });

    it('does not stack overflow on a self-referential message', () => {
      const ctx = { messages: { loop: '[[loop]]' } };
      expect(() => resolveValuesInString('[[loop]]', ctx)).not.toThrow();
    });

    it('resolves a {{ }} data ref inside a [[ ]] key, then looks it up', () => {
      const ctx = {
        messages: { 'experience.lsd': 'Algo sobre el LSD' },
        screenData: { drug: 'lsd' },
      };
      expect(
        resolveValuesInString('[[experience.{{$drug}}]]', ctx),
      ).toBe('Algo sobre el LSD');
    });

    it('renders the reduced literal when the computed key is missing', () => {
      const ctx = {
        messages: { 'experience.marijuana': 'x' },
        screenData: { drug: 'lsd' },
      };
      expect(
        resolveValuesInString('[[experience.{{$drug}}]]', ctx),
      ).toBe('[[experience.lsd]]');
    });

    it('renders the unreduced literal when the inner {{ }} cannot resolve', () => {
      const ctx = { messages: { 'experience.lsd': 'x' } };
      expect(
        resolveValuesInString('[[experience.{{$drug}}]]', ctx),
      ).toBe('[[experience.{{$drug}}]]');
    });

    it('resolves a $$ data ref inside a [[ ]] key', () => {
      const ctx = {
        messages: { 'experience.lsd': 'About LSD' },
        data: { drug: 'lsd' },
      };
      expect(
        resolveValuesInString('[[experience.{{$$drug}}]]', ctx),
      ).toBe('About LSD');
    });

    it('does NOT re-interpret a [[ ]] that surfaces from piped data', () => {
      // $$answer holds participant text that happens to contain [[other]].
      // It appears only AFTER the {{ }} pass, so it must stay literal:
      // participant data can never forge a dictionary lookup.
      const ctx = {
        messages: { other: 'SECRET' },
        data: { answer: '[[other]]' },
      };
      expect(resolveValuesInString('{{$$answer}}', ctx)).toBe('[[other]]');
    });
  });
});

import { describe, expect, it } from "vitest";
import { resolveOptionsSource, resolveLikertOptionsSource, resolveValuesInString } from "../resolve";

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

describe("resolveValuesInString", () => {
  describe("@ references (loopData)", () => {
    it("replaces {{@loopId.value}} with the current loop item value", () => {
      const ctx = { loopData: { "loop-sports": { value: "soccer", index: 0 } } };
      expect(resolveValuesInString("I like {{@loop-sports.value}}", ctx)).toBe("I like soccer");
    });

    it("replaces {{@loopId.index}} with the current loop item index", () => {
      const ctx = { loopData: { "loop-sports": { value: "x", index: 2 } } };
      expect(resolveValuesInString("Item {{@loop-sports.index}}", ctx)).toBe("Item 2");
    });

    it("replaces {{@loopId.index}} when index is 0 (does not leave token)", () => {
      const ctx = { loopData: { "loop-sports": { value: "x", index: 0 } } };
      expect(resolveValuesInString("Item {{@loop-sports.index}}", ctx)).toBe("Item 0");
    });

    it("leaves the token as-is when loopData for that id is undefined", () => {
      expect(resolveValuesInString("Hello {{@loop-sports.value}}", {})).toBe(
        "Hello {{@loop-sports.value}}",
      );
    });

    it("replaces multiple @ tokens in one string", () => {
      const ctx = { loopData: { "loop-sports": { value: "chess", index: 0 } } };
      expect(
        resolveValuesInString("{{@loop-sports.value}} and {{@loop-sports.value}}", ctx),
      ).toBe("chess and chess");
    });

    it("resolves tokens for different loop ids independently", () => {
      const ctx = {
        loopData: {
          "loop-sports": { value: "football", index: 0 },
          "loop-colors": { value: "red", index: 1 },
        },
      };
      expect(
        resolveValuesInString("{{@loop-sports.value}} / {{@loop-colors.value}}", ctx),
      ).toBe("football / red");
    });
  });

  describe("# references (foreachData)", () => {
    it("replaces {{#foreachId.value}} with the foreach item value", () => {
      const ctx = {
        screenData: { foreachData: { "foreach-sport": { value: "tennis", index: 0 } } },
      };
      expect(resolveValuesInString("Sport: {{#foreach-sport.value}}", ctx)).toBe("Sport: tennis");
    });

    it("replaces {{#foreachId.index}} with the foreach item index", () => {
      const ctx = {
        screenData: { foreachData: { "foreach-sport": { value: "tennis", index: 3 } } },
      };
      expect(resolveValuesInString("Index: {{#foreach-sport.index}}", ctx)).toBe("Index: 3");
    });

    it("leaves the token as-is when foreachData is undefined", () => {
      expect(resolveValuesInString("{{#foreach-sport.value}}", {})).toBe(
        "{{#foreach-sport.value}}",
      );
    });
  });

  describe("$$ references (context.data)", () => {
    it("replaces {{$$key}} with the value from context.data", () => {
      const ctx = { data: { welcome: { name: "Juan" } } };
      expect(resolveValuesInString("Hi {{$$welcome.name}}!", ctx)).toBe("Hi Juan!");
    });

    it("resolves deeply nested paths", () => {
      const ctx = { data: { a: { b: { c: "deep" } } } };
      expect(resolveValuesInString("{{$$a.b.c}}", ctx)).toBe("deep");
    });

    it("resolves hyphenated keys in the path", () => {
      const ctx = { data: { "prayer-frequency": "daily" } };
      expect(resolveValuesInString("Frequency: {{$$prayer-frequency}}", ctx)).toBe("Frequency: daily");
    });

    it("resolves hyphenated segments in a dotted path", () => {
      const ctx = { data: { survey: { "follow-up": "yes" } } };
      expect(resolveValuesInString("{{$$survey.follow-up}}", ctx)).toBe("yes");
    });

    it("leaves the token as-is when the path does not resolve", () => {
      const ctx = { data: { welcome: {} } };
      expect(resolveValuesInString("Hi {{$$welcome.name}}", ctx)).toBe("Hi {{$$welcome.name}}");
    });

    it("leaves the token as-is when context.data is undefined", () => {
      expect(resolveValuesInString("{{$$foo.bar}}", {})).toBe("{{$$foo.bar}}");
    });

    it("resolves multiple distinct $$ tokens in one string", () => {
      const ctx = { data: { a: { x: "foo" }, b: { y: "bar" } } };
      expect(resolveValuesInString("{{$$a.x}} and {{$$b.y}}", ctx)).toBe("foo and bar");
    });
  });

  describe("$ references (context.screenData)", () => {
    it("replaces {{$key}} with the value from context.screenData", () => {
      const ctx = { screenData: { slider: 5 } };
      expect(resolveValuesInString("Value: {{$slider}}", ctx)).toBe("Value: 5");
    });

    it("leaves the token as-is when the path does not resolve", () => {
      expect(resolveValuesInString("{{$missing}}", {})).toBe("{{$missing}}");
    });
  });

  describe("mixed references", () => {
    it("resolves both @ and $$ tokens in the same string", () => {
      const ctx = {
        data: { welcome: { name: "Juan" } },
        loopData: { "loop-sports": { value: "soccer", index: 0 } },
      };
      expect(
        resolveValuesInString("{{$$welcome.name}} likes {{@loop-sports.value}}", ctx),
      ).toBe("Juan likes soccer");
    });

    it("resolves both $$ and $ tokens in the same string", () => {
      const ctx = {
        data: { welcome: { name: "Juan" } },
        screenData: { age: 30 },
      };
      expect(
        resolveValuesInString("{{$$welcome.name}} is {{$age}}", ctx),
      ).toBe("Juan is 30");
    });
  });

  describe("edge cases", () => {
    it("returns the string unchanged when there are no tokens", () => {
      expect(resolveValuesInString("No tokens here", {})).toBe("No tokens here");
    });

    it("converts non-string resolved values to string", () => {
      const ctx = { loopData: { "loop-scores": { value: 42, index: 0 } } };
      expect(resolveValuesInString("Score: {{@loop-scores.value}}", ctx)).toBe("Score: 42");
    });
  });
});

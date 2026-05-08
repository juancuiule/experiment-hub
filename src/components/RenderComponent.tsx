"use client";

import { Audio } from "./content/Audio";
import { Image } from "./content/Image";
import { RichText } from "./content/RichText";
import { Video } from "./content/Video";
import { Conditional } from "./control/Conditional";
import { ForEach } from "./control/ForEach";
import { Button } from "./layout/Button";
import { Group } from "./layout/Group";
import { Checkboxes } from "./response/Checkboxes";
import { DateInput } from "./response/DateInput";
import { Dropdown } from "./response/Dropdown";
import { LikertScale } from "./response/LikertScale";
import { NumericInput } from "./response/NumericInput";
import { Radio } from "./response/Radio";
import { SingleCheckbox } from "./response/SingleCheckbox";
import { Slider } from "./response/Slider";
import { TextArea } from "./response/TextArea";
import { TextInput } from "./response/TextInput";
import { TimeInput } from "./response/TimeInput";
import { RenderProps } from "./primitives";
import { deepMerge } from "@/lib/flow";
import { resolveValuesInString } from "@/lib/resolve";
import { useComponentRegistry } from "@/lib/registry";

const renderChild = (props: RenderProps) => <RenderComponent {...props} />;

export function RenderComponent({
  component,
  form,
  context: propContext,
  isLoading,
}: RenderProps) {
  const screenData = form.watch();
  const context = deepMerge(propContext, { screenData });
  const registry = useComponentRegistry();

  switch (component.componentFamily) {
    case "content": {
      switch (component.template) {
        case "rich-text": {
          const Custom = registry["rich-text"];
          const props = { component, context };
          return Custom ? <Custom {...props} /> : <RichText {...props} />;
        }
        case "image":
          return <Image component={component} />;
        case "video":
          return <Video component={component} />;
        case "audio":
          return <Audio component={component} />;
      }
    }

    case "response": {
      const resolvedComponent = deepMerge(component, {
        props: {
          dataKey: resolveValuesInString(component.props.dataKey, context),
        },
      });
      const props = { form, context, component: resolvedComponent };

      switch (component.template) {
        case "text-input": {
          const Custom = registry["text-input"];
          return Custom ? <Custom {...props} /> : <TextInput {...props} />;
        }
        case "text-area": {
          const Custom = registry["text-area"];
          return Custom ? <Custom {...props} /> : <TextArea {...props} />;
        }
        case "date-input": {
          const Custom = registry["date-input"];
          return Custom ? <Custom {...props} /> : <DateInput {...props} />;
        }
        case "time-input": {
          const Custom = registry["time-input"];
          return Custom ? <Custom {...props} /> : <TimeInput {...props} />;
        }
        case "numeric-input": {
          const Custom = registry["numeric-input"];
          return Custom ? <Custom {...props} /> : <NumericInput {...props} />;
        }
        case "single-checkbox": {
          const Custom = registry["single-checkbox"];
          return Custom ? <Custom {...props} /> : <SingleCheckbox {...props} />;
        }
        case "checkboxes": {
          const Custom = registry["checkboxes"];
          return Custom ? <Custom {...props} /> : <Checkboxes {...props} />;
        }
        case "radio": {
          const Custom = registry["radio"];
          return Custom ? <Custom {...props} /> : <Radio {...props} />;
        }
        case "dropdown": {
          const Custom = registry["dropdown"];
          return Custom ? <Custom {...props} /> : <Dropdown {...props} />;
        }
        case "slider": {
          const Custom = registry["slider"];
          return Custom ? <Custom {...props} /> : <Slider {...props} />;
        }
        case "likert-scale": {
          const Custom = registry["likert-scale"];
          return Custom ? <Custom {...props} /> : <LikertScale {...props} />;
        }
      }
    }

    case "layout": {
      switch (component.template) {
        case "button": {
          const Custom = registry["button"];
          const buttonProps = { component, isLoading };
          return Custom ? <Custom {...buttonProps} /> : <Button {...buttonProps} />;
        }
        case "group":
          return (
            <Group
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
      }
    }

    case "control": {
      switch (component.template) {
        case "conditional":
          return (
            <Conditional
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
        case "for-each":
          return (
            <ForEach
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
      }
    }
  }

  return (
    <pre className="text-xs my-2 bg-surface p-2 rounded">
      <code>{JSON.stringify(component, null, 2)}</code>
    </pre>
  );
}

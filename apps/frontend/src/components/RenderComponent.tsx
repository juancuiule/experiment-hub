'use client';

import { resolveCondition } from '@experiment-hub/engine/conditions';
import { deepMerge } from '@experiment-hub/engine/flow';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Accordion } from './content/Accordion';
import { Audio } from './content/Audio';
import { Image as ImageRenderer } from './content/Image';
import { RichText } from './content/RichText';
import { Video } from './content/Video';
import { Conditional } from './control/Conditional';
import { ForEach } from './control/ForEach';
import { Button } from './layout/Button';
import { Group } from './layout/Group';
import { RenderProps } from './primitives';
import { Checkboxes } from './response/Checkboxes';
import { DateInput } from './response/DateInput';
import { Dropdown } from './response/Dropdown';
import { LikertScale } from './response/LikertScale';
import { NumericInput } from './response/NumericInput';
import { Radio } from './response/Radio';
import { SingleCheckbox } from './response/SingleCheckbox';
import { Slider } from './response/Slider';
import { TextArea } from './response/TextArea';
import { TextInput } from './response/TextInput';
import { TimeInput } from './response/TimeInput';

export function RenderComponent({
  component,
  form,
  context: propContext,
  isLoading,
  sharedOptions,
}: RenderProps) {
  const screenData = form.watch(); // Watch all form values to have them available in context
  const context = deepMerge(propContext, { screenData }); // Add form values to context for easier access in components

  const renderChild = (props: RenderProps) => (
    <RenderComponent {...props} sharedOptions={sharedOptions} />
  );

  switch (component.componentFamily) {
    case 'content': {
      switch (component.template) {
        case 'rich-text':
          return <RichText component={component} context={context} />;
        case 'image':
          return <ImageRenderer component={component} context={context} />;
        case 'video':
          return <Video component={component} />;
        case 'audio':
          return <Audio component={component} />;
        case 'accordion':
          return <Accordion component={component} context={context} />;
      }
      return null;
    }

    case 'response': {
      const mergedResponseComponent: any = deepMerge(component, {
        props: {
          dataKey: resolveValuesInString(component.props.dataKey, context),
        },
      });
      const props = {
        form,
        context,
        sharedOptions,
        component: mergedResponseComponent,
      };
      switch (component.template) {
        case 'text-input':
          return <TextInput {...props} />;
        case 'text-area':
          return <TextArea {...props} />;
        case 'date-input':
          return <DateInput {...props} />;
        case 'time-input':
          return <TimeInput {...props} />;
        case 'numeric-input':
          return <NumericInput {...props} />;
        case 'single-checkbox':
          return <SingleCheckbox {...props} />;
        case 'checkboxes':
          return <Checkboxes {...props} />;
        case 'radio':
          return <Radio {...props} />;
        case 'dropdown':
          return <Dropdown {...props} />;
        case 'slider':
          return <Slider {...props} />;
        case 'likert-scale':
          return <LikertScale {...props} />;
      }
      return null;
    }

    case 'layout': {
      switch (component.template) {
        case 'button': {
          const mergedButtonComponent = deepMerge(component, {
            props: {
              payload: component.props.payload
                ? {
                    dataKey: resolveValuesInString(
                      component.props.payload.dataKey,
                      context,
                    ),
                    value:
                      typeof component.props.payload.value === 'string'
                        ? resolveValuesInString(
                            component.props.payload.value,
                            context,
                          )
                        : component.props.payload.value,
                  }
                : undefined,
            },
          });
          return (
            <Button
              component={mergedButtonComponent}
              isLoading={isLoading}
              context={context}
              form={form}
            />
          );
        }
        case 'group':
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
      return null;
    }

    case 'control': {
      switch (component.template) {
        case 'conditional': {
          const mergedConditionalComponent: any = deepMerge(component, {
            props: {
              if: resolveCondition(component.props.if, context),
            },
          });
          const props = {
            form,
            context,
            component: mergedConditionalComponent,
          };
          return (
            <Conditional
              {...props}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
        }
        case 'for-each':
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
      return null;
    }
  }

  return (
    <pre className="bg-background-surface text-content-primary my-2 rounded p-2 text-xs">
      <code>{JSON.stringify(component, null, 2)}</code>
    </pre>
  );
}
